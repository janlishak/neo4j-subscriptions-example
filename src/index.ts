import { createServer } from "http";
import express from "express";
import { ApolloServer, gql } from "apollo-server-express";
import { ApolloServerPluginDrainHttpServer } from "apollo-server-core";
import { WebSocketServer } from "ws";
import { useServer } from "graphql-ws/lib/use/ws";
import neo4j from "neo4j-driver"
import { Neo4jGraphQL, Neo4jGraphQLSubscriptionsSingleInstancePlugin } from "@neo4j/graphql"

// config
const driver = neo4j.driver("bolt://127.0.0.1:7687", neo4j.auth.basic("neo4j", "123456"));
const PORT = 4000;

// types
const typeDefs = `
    type Movie {
        title: String
    }

    type Actor {
        name: String
    }
`;

// schema
const neoSchema = new Neo4jGraphQL({
  typeDefs,
  driver,
  plugins: {
      subscriptions: new Neo4jGraphQLSubscriptionsSingleInstancePlugin(),
  },
});
const schema = await neoSchema.getSchema();

// express and websocket setup
const app = express();
const httpServer = createServer(app);
const wsServer = new WebSocketServer({
  server: httpServer,
  path: "/graphql",
});

const serverCleanup = useServer({ schema }, wsServer);
const server = new ApolloServer({
  schema,
  plugins: [
    ApolloServerPluginDrainHttpServer({ httpServer }),
    {
      async serverWillStart() {
        return {
          async drainServer() {
            await serverCleanup.dispose();
          },
        };
      },
    },
  ],
});

await server.start();
server.applyMiddleware({ app });

httpServer.listen(PORT, () => {
  console.log(`🚀 Query endpoint ready at http://localhost:${PORT}${server.graphqlPath}`);
  console.log(`🚀 Subscription endpoint ready at ws://localhost:${PORT}${server.graphqlPath}`);
});