require('dotenv').config()
const express = require('express')
const { ApolloServer, gql, makeExecutableSchema, ForbiddenError, AuthenticationError } = require('apollo-server')
const { registerServer } = require('apollo-server-express')
const jwt = require('express-jwt')
const cors = require('cors')
const jwks = require('jwks-rsa')
const neo4j = require('neo4j-driver').v1;
const {neo4jgraphql} = require('neo4j-graphql-js');



const app = express()

const typeDefs = gql`
  directive @isAuthenticated on FIELD | FIELD_DEFINITION
  directive @hasRole(role: String) on FIELD | FIELD_DEFINITION

  type Movie {
    title: String
    releaseDate: Float
    tagline: String
    actors(first: Int = 3, offset: Int = 0): [Person] @relation(name: "ACTED_IN", direction:"IN")
    similar(first: Int = 3, offset: Int = 0): [Movie] @cypher(statement: "WITH {this} AS this MATCH (this)--(:Genre)--(o:Movie) RETURN o LIMIT {limit}")
    degree: Int @cypher(statement: "WITH {this} AS this RETURN SIZE((this)--())")
  }

  type Person {
    id: ID!
    name: String
    movies: [Movie]
  }

  type Query {
    hello: String,
    helloUser: String,
    authentication: String @isAuthenticated,
    permission: String @hasRole(role:"Admin"),
    listMovies(title: String, first: Int, offset: Int): [Movie]
  }

`;

const directiveResolvers = {
  isAuthenticated: (next, source, args, ctx) => {
    const user = ctx.user
    if (user) return next()
    throw AuthenticationError("You must be logged in to see this");
  },
  hasRole: (next, source, { role }, ctx) => {
    const user = ctx.user
    if (user){
      const roles = ctx.roles
      if (roles.includes(role)) return next()
      throw ForbiddenError(`Must have ${role} permissions to view this field`)
    }
    throw AuthenticationError(`Must be logged in as ${role} to view this field`)
  },
}

const resolvers = {
  Query: {
    hello: () => 'Hello world!',
    helloUser (root, args, ctx, info) {
      var d = new Date();
      const user = ctx.user

      const name = user ? user.nickname : 'there'
      return `Hello ${name} (${d})`
    },
    permission: () => 'Looks like you have the right permissions',
    authentication: () => "Looks like you're logged in",
    listMovies(object, params, ctx, resolveInfo) {
      // neo4jgraphql inspects the GraphQL query and schema to generate a single Cypher query
      // to resolve the GraphQL query. Assuming a Neo4j driver instance exists in the context
      // the query is executed against Neo4j
     return neo4jgraphql(object, params, ctx, resolveInfo);
   }
  }
}

// enable CORS
app.use(cors())

// define auth middleware
const auth = jwt({
  secret: jwks.expressJwtSecret({
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 5,
    jwksUri: `${process.env.AUTH0_ISSUER}.well-known/jwks.json`
  }),
  credentialsRequired: false,
  audience: process.env.AUTH0_AUDIENCE,
  issuer: process.env.AUTH0_ISSUER,
  algorithms: ['RS256']
})

const errorHandler = (err, req, res, next) => {
  //Log all errors and continue
  //Need to catch expired tokens
  console.log(err.name+": "+err.message)
  return next()
}

// add authentication middleware
app.use(auth, errorHandler)

// get roles for user...to be changed later
function lookupRolesForUser(user){
  var roles = []
  if (user){
    roles = user.roles
  }
  return roles
}

// update context
const context = ({ req }) => {

  //add driver to context
  let driver;
  if (!driver){
  	// driver = neo4j.driver("bolt://localhost:7687", neo4j.auth.basic("neo4j", "password"))
    driver = neo4j.driver(process.env.NEO4J_URI || "bolt://localhost:7687", neo4j.auth.basic(process.env.NEO4J_USERNAME || "neo4j", process.env.NEO4J_PASSWORD || "password"))

  }

  //add user object to context
  const user = req.user
  const roles = lookupRolesForUser(user);

  return { user, roles, driver }
};





const schema = makeExecutableSchema({
  typeDefs,
  resolvers,
  directiveResolvers
});

const server = new ApolloServer({
  schema,
  context
});

registerServer({ server, app })

// normal ApolloServer listen call but url will contain /graphql
server.listen().then(({ url }) => {
  console.log(`🚀 Server ready at ${url}`)
})
