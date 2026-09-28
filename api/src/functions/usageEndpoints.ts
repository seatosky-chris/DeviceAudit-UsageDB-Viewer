import pkg from "@azure/functions"
import { CosmosClient, type Container } from "@azure/cosmos"

const { app } = pkg

type HttpRequest = pkg.HttpRequest
type InvocationContext = pkg.InvocationContext
type HttpResponseInit = pkg.HttpResponseInit

type EntityType = "computer" | "user"

interface UsageDocument {
    DaysActive?: {
        Total?: number
        LastMonth?: number
        LastMonthPercent?: number
        History?: Record<string, number>
        HistoryPercent?: Record<string, number>
    }
    LastActive?: string
}

const databaseName = "DeviceUsage"
const maximumPageSize = 100
const itGlueOrganizationIdPlaceholder = /\{organizationID\}|\{organizationId\}/
const itGlueOrganizationIdCache = new Map<string, Promise<string | null>>()

interface KeyBrokerResponse {
    Token?: unknown
}

class KeyBrokerError extends Error {
    constructor(message: string, readonly statusCode = 502) {
        super(message)
    }
}

function getEntityType(value: string | null): EntityType | null {
    return value === "computer" || value === "user" ? value : null
}

function getAccountName(request: HttpRequest): string | null {
    const value = request.query.get("accountName")?.toLowerCase()
    return value && /^stats-[a-z0-9-]{1,44}$/.test(value) ? value : null
}

function getCustomerCode(accountName: string): string {
    const customerMapSetting = process.env.KEY_BROKER_CUSTOMER_MAP
    if (customerMapSetting) {
        let customerMap: Record<string, unknown>
        try {
            customerMap = JSON.parse(customerMapSetting) as Record<string, unknown>
        } catch {
            throw new KeyBrokerError("KEY_BROKER_CUSTOMER_MAP must be valid JSON.", 500)
        }

        const mappedCustomer = customerMap[accountName]
        if (typeof mappedCustomer === "string" && mappedCustomer.trim()) {
            return mappedCustomer.trim()
        }
    }

    return accountName.slice("stats-".length).toUpperCase()
}

async function getResourceToken(accountName: string, tokenType: string): Promise<string> {
    const brokerUrl = process.env.KEY_BROKER_URL
    const brokerApiKey = process.env.KEY_BROKER_API_KEY
    if (!brokerUrl || !brokerApiKey) {
        throw new KeyBrokerError("Configure KEY_BROKER_URL and KEY_BROKER_API_KEY in the Functions app settings.", 503)
    }

    let parsedBrokerUrl: URL
    try {
        parsedBrokerUrl = new URL(brokerUrl)
    } catch {
        throw new KeyBrokerError("KEY_BROKER_URL is not a valid URL.", 500)
    }
    if (parsedBrokerUrl.protocol !== "https:") {
        throw new KeyBrokerError("KEY_BROKER_URL must use HTTPS.", 500)
    }

    let response: Response
    try {
        response = await fetch(parsedBrokerUrl, {
            method: "POST",
            headers: {
                "content-type": "application/json",
                "x-api-key": brokerApiKey
            },
            body: JSON.stringify({
                customer: getCustomerCode(accountName),
                tokenType
            }),
            signal: AbortSignal.timeout(10000)
        })
    } catch {
        throw new KeyBrokerError("Could not connect to the Key Broker.")
    }

    if (!response.ok) {
        throw new KeyBrokerError(`Key Broker rejected the token request (HTTP ${response.status}).`, response.status === 401 || response.status === 403 ? 403 : 502)
    }

    let tokenResponse: KeyBrokerResponse
    try {
        tokenResponse = await response.json() as KeyBrokerResponse
    } catch {
        throw new KeyBrokerError("Key Broker returned an invalid response.")
    }

    if (typeof tokenResponse.Token !== "string" || !tokenResponse.Token) {
        throw new KeyBrokerError("Key Broker response did not include a resource token.")
    }

    return tokenResponse.Token
}

function getContainer(accountName: string, name: string, token: string): Container {
    const client = new CosmosClient({
        endpoint: `https://${accountName}.documents.azure.com:443/`,
        tokenProvider: async () => token
    })

    return client.database(databaseName).container(name)
}

function getItGlueOrganizationId(accountName: string): Promise<string | null> {
    const cachedOrganizationId = itGlueOrganizationIdCache.get(accountName)
    if (cachedOrganizationId) return cachedOrganizationId

    const organizationIdPromise = (async (): Promise<string | null> => {
        try {
            const token = await getResourceToken(accountName, "variables")
            const response = await getContainer(accountName, "Variables", token)
                .items.query<{ ITGOrgID?: unknown }>({
                    query: "SELECT TOP 1 c.ITGOrgID FROM c WHERE c.variable = @variable",
                    parameters: [{ name: "@variable", value: "ITGOrgID" }]
                })
                .fetchAll()
            const organizationId = response.resources[0]?.ITGOrgID
            return typeof organizationId === "string" && /^\d+$/.test(organizationId)
                ? organizationId
                : null
        } catch {
            return null
        }
    })()

    itGlueOrganizationIdCache.set(accountName, organizationIdPromise)
    return organizationIdPromise
}

function splitExternalIds(value: unknown): string[] {
    if (typeof value !== "string" && typeof value !== "number") return []

    return [...new Set(String(value)
        .split("|")
        .map(id => id.trim())
        .filter(Boolean))]
}

function buildExternalLinks(baseUrlValue: string | undefined, idValue: unknown): string[] {
    if (!baseUrlValue?.trim()) return []

    let baseUrl: URL
    try {
        baseUrl = new URL(baseUrlValue.trim())
    } catch {
        return []
    }
    if (baseUrl.protocol !== "https:" || baseUrl.username || baseUrl.password) return []

    const basePath = baseUrl.pathname.replace(/\/+$/, "")
    return splitExternalIds(idValue).map(id => {
        const link = new URL(baseUrl)
        link.pathname = `${basePath}/${encodeURIComponent(id)}`
        return link.toString()
    })
}

function buildItGlueLinks(
    baseUrlValue: string | undefined,
    idValue: unknown,
    organizationId: string | null,
    entityType: EntityType
): string[] {
    if (!organizationId || !baseUrlValue?.trim() || !itGlueOrganizationIdPlaceholder.test(baseUrlValue)) return []

    let baseUrl: URL
    try {
        baseUrl = new URL(baseUrlValue.trim().replace(itGlueOrganizationIdPlaceholder, encodeURIComponent(organizationId)))
    } catch {
        return []
    }
    if (baseUrl.protocol !== "https:" || baseUrl.username || baseUrl.password) return []

    const basePath = baseUrl.pathname
        .replace(/\/(?:configurations|contacts)\/?$/, "")
        .replace(/\/+$/, "")
    const collection = entityType === "computer" ? "configurations" : "contacts"
    baseUrl.pathname = `${basePath}/${collection}`

    return buildExternalLinks(baseUrl.toString(), idValue)
}

function badRequest(message: string): HttpResponseInit {
    return { status: 400, jsonBody: { error: message } }
}

function isForbidden(error: unknown): boolean {
    return typeof error === "object" && error !== null &&
        (("code" in error && error.code === 403) || ("statusCode" in error && error.statusCode === 403))
}

function tokenRejected(): HttpResponseInit {
    return {
        status: 403,
        jsonBody: {
            error: "Cosmos DB rejected the broker token. Verify the customer mapping and that the requested tokenType grants access to this container."
        }
    }
}

export async function getEntities(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    const accountName = getAccountName(request)
    const entityType = getEntityType(request.query.get("entityType"))

    if (!accountName || !entityType) {
        return badRequest("A valid stats-* accountName and entityType (computer or user) are required.")
    }

    const requestedPageSize = Number.parseInt(request.query.get("pageSize") ?? "50", 10)
    const pageSize = Number.isFinite(requestedPageSize)
        ? Math.min(Math.max(requestedPageSize, 1), maximumPageSize)
        : 50
    const continuationToken = request.query.get("continuationToken")
    const includeOlder = request.query.get("includeOlder") === "true"
    const containerName = entityType === "computer" ? "Computers" : "Users"
    const query = (entityType === "computer"
        ? "SELECT c.id, c.Hostname, c.SerialNumber, c.RMM_ID, c.ITG_ID, c.DeviceType, c.Manufacturer, c.Model, c.OS, c.LastUpdated FROM c WHERE c.type = @type"
        : "SELECT c.id, c.Username, c.ADUsername, c.ITG_ID, c.Domain, c.DomainOrLocal, c.O365Email, c.LastUpdated FROM c WHERE c.type = @type")
        + (includeOlder ? "" : " AND c.LastUpdated >= @cutoff")
    const cutoff = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString()

    try {
        const tokenType = entityType === "computer" ? "computers" : "users"
        const token = await getResourceToken(accountName, tokenType)
        const itGlueOrganizationId = process.env.ITGLUE_BASE_URL && itGlueOrganizationIdPlaceholder.test(process.env.ITGLUE_BASE_URL)
            ? await getItGlueOrganizationId(accountName)
            : null
        const options = {
            partitionKey: entityType,
            maxItemCount: pageSize,
            ...(continuationToken ? { continuationToken } : {})
        }
        const page = await getContainer(accountName, containerName, token)
            .items.query({
                query,
                parameters: [
                    { name: "@type", value: entityType },
                    ...(!includeOlder ? [{ name: "@cutoff", value: cutoff }] : [])
                ]
            }, options)
            .fetchNext()

        return {
            status: 200,
            jsonBody: {
                entities: page.resources.map(entity => ({
                    ...entity,
                    links: {
                        itGlue: buildItGlueLinks(process.env.ITGLUE_BASE_URL, entity.ITG_ID, itGlueOrganizationId, entityType),
                        dattoRmm: entityType === "computer"
                            ? buildExternalLinks(process.env.DATTO_RMM_BASE_URL, entity.RMM_ID)
                            : []
                    }
                })),
                continuationToken: page.continuationToken ?? null
            }
        }
    } catch (error) {
        context.error("Failed to query Cosmos DB entities:", error)
        if (error instanceof KeyBrokerError) {
            return { status: error.statusCode, jsonBody: { error: error.message } }
        }
        if (isForbidden(error)) return tokenRejected()
        return {
            status: 500,
            jsonBody: { error: "Failed to load entities from Cosmos DB." }
        }
    }
}

export async function getEntityUsage(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    const accountName = getAccountName(request)
    const entityType = getEntityType(request.query.get("entityType"))
    const entityId = request.query.get("entityId")

    if (!accountName || !entityType || !entityId || entityId.length > 255) {
        return badRequest("A valid stats-* accountName, entityType, and entityId are required.")
    }

    const containerName = entityType === "computer" ? "ComputerUsage" : "UserUsage"
    const configuredPercentage = Number(process.env.PART_TIME_PERCENTAGE ?? 70)
    const partTimePercentage = Number.isFinite(configuredPercentage) && configuredPercentage >= 0 && configuredPercentage <= 100
        ? configuredPercentage
        : 70

    try {
        const tokenType = entityType === "computer" ? "computerusage" : "userusage"
        const token = await getResourceToken(accountName, tokenType)
        const response = await getContainer(accountName, containerName, token)
            .item(entityId, entityId)
            .read<UsageDocument>()

        return {
            status: 200,
            jsonBody: {
                daysActive: response.resource?.DaysActive ?? {},
                lastActive: response.resource?.LastActive ?? null,
                partTimePercentage
            }
        }
    } catch (error) {
        if (typeof error === "object" && error !== null && "code" in error && error.code === 404) {
            return { status: 200, jsonBody: { daysActive: {}, lastActive: null, partTimePercentage } }
        }

        context.error("Failed to read Cosmos DB usage:", error)
        if (error instanceof KeyBrokerError) {
            return { status: error.statusCode, jsonBody: { error: error.message } }
        }
        if (isForbidden(error)) return tokenRejected()
        return {
            status: 500,
            jsonBody: { error: "Failed to load usage history from Cosmos DB." }
        }
    }
}

app.http("getEntities", {
    methods: ["GET"],
    authLevel: "anonymous",
    handler: getEntities
})

app.http("getEntityUsage", {
    methods: ["GET"],
    authLevel: "anonymous",
    handler: getEntityUsage
})