const express = require('express')
const { ApolloServer, gql, makeExecutableSchema, ForbiddenError, AuthenticationError } = require('apollo-server')
const { registerServer } = require('apollo-server-express')
const jwt = require('express-jwt')
const cors = require('cors')
var jwks = require('jwks-rsa')
require('dotenv').config()

const app = express()

const typeDefs = gql`
  directive @isAuthenticated on FIELD | FIELD_DEFINITION
  directive @hasRole(role: String) on FIELD | FIELD_DEFINITION

  type Query {
    hello: String,
    helloUser: String,
    authentication: String @isAuthenticated,
    permission: String @hasRole(role:"Admin")
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
      const user = ctx.user
      const name = user ? user.nickname : 'there'
      return `Hello ${name}`
    },
    permission: () => 'Looks like you have the right permissions',
    authentication: () => "Looks like you're logged in"
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

// add authentication middleware
app.use(auth)

// get roles for user...to be changed later
function lookupRolesForUser(user){
  var roles = []
  if (user){
    roles = user.roles
  }
  return roles
}

// add user object to context
const context = ({ req }) => {
  const user = req.user
  const roles = lookupRolesForUser(user);
  return { user, roles }
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
