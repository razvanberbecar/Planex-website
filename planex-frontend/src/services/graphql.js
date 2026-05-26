// GraphQL helper for Planex
// Use the current hostname so it works from any device on the network
const GRAPHQL_URL = `http://${window.location.hostname}:3001/graphql`

/**
 * Send a GraphQL query or mutation
 * @param {string} query - GraphQL query/mutation string
 * @param {object} variables - Variables for the query/mutation
 * @returns {Promise<any>} - The data from the response
 */
export async function graphqlRequest(query, variables = {}) {
  const res = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables })
  })
  const json = await res.json()
  if (json.errors) throw new Error(json.errors.map(e => e.message).join(', '))
  return json.data
}
