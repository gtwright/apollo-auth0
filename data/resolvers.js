// sample data
const todos = []

const resolvers = {
  Query: {
    // fetch authenticated user todos
    myTodos (_, args, { user }) {

      // return only the authenticated user todos
      return todos.filter(todo => todo.userId === user.sub)
    },
    allTodos (_, args, { user }) {

      // return only the authenticated user todos
      return todos
    }
  },

  Mutation: {
    // Add new todo
    addTodo (_, { title }, { user }) {

      // add new todo to list of todos
      todos.push({
        userId: user.sub,
        title
      })

      // return the newly added todo
      return todos.find(todo => todo.userId === user.sub && todo.title === title)
    }
  }
}

module.exports = resolvers
