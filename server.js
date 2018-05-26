require('dotenv').config();
const express = require('express');
const { ApolloServer, gql, makeExecutableSchema, ForbiddenError, AuthenticationError } = require('apollo-server');
const { registerServer } = require('apollo-server-express');
const neo4j = require('neo4j-driver').v1;
const {neo4jgraphql} = require('neo4j-graphql-js');

const app = express();

const typeDefs = gql`

  type Movie {
    id: ID!
    title: String
    tagline: String
    actors(first: Int = 3, offset: Int = 0): [Person] @relation(name: "ACTS_IN", direction:"IN")
    similar(first: Int = 3, offset: Int = 0): [Movie]
    degree: Int @cypher(statement: "WITH {this} AS this RETURN SIZE((this)--())")
  }

  type Person {
    id: ID!
    name: String
    movies: [Movie]
  }

  type Query {
    hello: String,
    listMovies(title: String, first: Int, offset: Int): [Movie],
    movies(limit: Int!): [Movie]
  }

`;


const resolvers = {
  Query: {
    hello: () => 'Hello world!',
    listMovies(object, params, ctx, resolveInfo) {
      // neo4jgraphql inspects the GraphQL query and schema to generate a single Cypher query
      // to resolve the GraphQL query. Assuming a Neo4j driver instance exists in the context
      // the query is executed against Neo4j
     return neo4jgraphql(object, params, ctx, resolveInfo);
    },
    movies(_, params, ctx) {
      let session = ctx.driver.session();
      let query = "MATCH (movie:Movie) RETURN movie LIMIT $limit;"
      return session.run(query, params)
        .then( result => { return result.records.map(record => { return record.get("movie").properties })})
    }

  },
  Movie:{
    similar: (object, _, context) => {
      let session = context.driver.session();
      let params = {id: object.id, limit: 5};
      console.log(object);
      let query = `
				MATCH (m)
        Where m.id = $id
				Match (m)-->(o)
				RETURN o LIMIT $limit;
			`;
      return session.run(query, params)
        .then( result => { return result.records.map(record => { return record.get("o").properties })})
    }
  }
};



// update context
const context = ({ req }) => {

  //add driver to context
  let driver;
  if (!driver){
  	// driver = neo4j.driver("bolt://localhost:7687", neo4j.auth.basic("neo4j", "password"))
    driver = neo4j.driver(
      process.env.NEO4J_URI || "bolt://localhost:7687",
      neo4j.auth.basic(process.env.NEO4J_USERNAME || "neo4j",
      process.env.NEO4J_PASSWORD || "password"))
  }
  return { driver }
};





const schema = makeExecutableSchema({
  typeDefs,
  resolvers
});

const server = new ApolloServer({
  schema,
  context
});

registerServer({ server, app })

// normal ApolloServer listen call but url will contain /graphql
server.listen().then(({ url }) => {
  console.log(`🚀 Server ready at ${url}`)
});
