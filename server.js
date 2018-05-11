const express = require('express')
const { ApolloServer, gql } = require('apollo-server')
const { registerServer } = require('apollo-server-express')
const jwt = require('express-jwt')
const cors = require('cors')
var jwks = require('jwks-rsa')
require('dotenv').config()

const app = express()

// enable CORS
app.use(cors())

// auth middleware
const auth = jwt({
  secret: jwks.expressJwtSecret({
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 5,
    jwksUri: `${process.env.AUTH0_ISSUER}.well-known/jwks.json`
  }),
  credentialsRequired: true,
  // audience: process.env.AUTH0_AUDIENCE,
  issuer: process.env.AUTH0_ISSUER,
  algorithms: ['RS256']
})

const typeDefs = gql`
  type Query {
    hello: String,
    helloUser: String
  }
`;

const resolvers = {
  Query: {
    hello: () => 'Hello world!',
    helloUser (root, args, context, info) {
      console.log("resolver")
      return `Hello`
    }
  },
}

app.use(auth, function(res,req,next){
  console.log("auth middle")
  next()
})

const server = new ApolloServer((req, typeDefs, resolvers)=>({
  typeDefs,
  resolvers
}));

registerServer({ server, app })



// normal ApolloServer listen call but url will contain /graphql
server.listen().then(({ url }) => {
  console.log(`🚀 Server ready at ${url}`)
})
