const { makeExecutableSchema } = require('graphql-tools')
const resolvers = require('./resolvers')

// Define our schema using the GraphQL schema language
const typeDefs = `
  directive @isAuthenticated on FIELD | FIELD_DEFINITION
  directive @hasRole(role: String) on FIELD | FIELD_DEFINITION

  type Todo {
    userId: ID! @hasRole(role:"Admin")
    title: String!
  }

  type Query {
    myTodos: [Todo] @isAuthenticated
    allTodos: [Todo]
  }

  type Mutation {
    addTodo (title: String!): Todo @hasRole(role:"Admin")
  }
`

const directiveResolvers = {
  isAuthenticated: (next, source, args, ctx) => {
    const user = ctx.user
    if (user) return next()
    throw new Error(`Must be logged in to view this field`)
  },
  hasRole: (next, source, { role }, ctx) => {
    const user = ctx.user
    console.log("user: "+JSON.stringify(user))
    console.log("source: "+JSON.stringify(source))
    if (user){
      try {
        const roles = user.roles
        if (roles.includes(role)) return next();
      }
      catch(err) {
        throw new Error(`Must have role: ${role}, you have role: ${user.roles}`)
      }
    }
    throw new Error(`Must be logged in as ${role} to view this field`)
  },

}

module.exports = makeExecutableSchema({ typeDefs, resolvers, directiveResolvers })
