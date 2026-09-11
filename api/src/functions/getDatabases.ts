import pkg from "@azure/functions"

const { app } = pkg

type HttpRequest = pkg.HttpRequest
type InvocationContext = pkg.InvocationContext
type HttpResponseInit = pkg.HttpResponseInit

import { DefaultAzureCredential } from "@azure/identity";
import { ResourceGraphClient } from "@azure/arm-resourcegraph";

export async function getDatabases(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    context.log(`Http function processed request for url "${request.url}"`);

    try {
        // DefaultAzureCredential uses your local Azure CLI/VS Code login during development
        // and the App's Managed Identity when deployed to Azure.
        const credential = new DefaultAzureCredential();
        const client = new ResourceGraphClient(credential);
        
        // Query Azure Resource Graph to find all Cosmos DB accounts matching "stats-*"
        // This automatically spans all subscriptions your identity can read.
        const queryResponse = await client.resources({
            query: "Resources | where type =~ 'Microsoft.DocumentDB/databaseAccounts' | where name startswith 'stats-' | project name"
        });
        
        // Map the result to an array of account names
        const dbAccounts = queryResponse.data.map((resource: any) => resource.name);

        return {
            status: 200,
            jsonBody: { databases: dbAccounts }
        };
    } catch (error: any) {
        context.log("Error querying Azure Resource Graph:", error);
        return { 
            status: 500, 
            jsonBody: { error: `Failed to find Cosmos DB accounts: ${error.message}` } 
        };
    }
}

app.http('getDatabases', {
    methods: ['GET'],
    authLevel: 'anonymous', 
    handler: getDatabases
});
