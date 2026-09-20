import java.util.*;

/**
 * ADSA Concept: Co-Watch Graph using Weighted Adjacency List
 *
 * Represents content co-watching relationships as a weighted undirected graph.
 *   Nodes  = content items (identified by integer ID)
 *   Edges  = "these two items were watched by the same user" (weight = frequency)
 *
 * Data structure: HashMap<Integer, HashMap<Integer, Integer>>
 *   Outer key  -> content node ID
 *   Inner key  -> neighbor node ID
 *   Value      -> co-watch count (edge weight)
 *
 * Time complexity to build: O(U * H^2) where U=users, H=avg history length
 */
public class CoWatchGraph {

    // Weighted adjacency list: node -> {neighbor -> weight}
    private final Map<Integer, Map<Integer, Integer>> adjacency;

    public CoWatchGraph() {
        adjacency = new HashMap<>();
    }

    /**
     * Adds (or increments) a co-watch edge between content items a and b.
     * Graph is undirected, so both directions are stored.
     */
    public void addEdge(int a, int b) {
        if (a == b) return;
        adjacency.computeIfAbsent(a, k -> new HashMap<>()).merge(b, 1, Integer::sum);
        adjacency.computeIfAbsent(b, k -> new HashMap<>()).merge(a, 1, Integer::sum);
    }

    /**
     * Builds the co-watch graph from a list of user watch histories.
     * For each user history, every pair of watched items gets a co-watch edge.
     * This captures "users who watched A also watched B" relationships.
     *
     * @param histories list of watch histories; each is a list of content IDs
     */
    public void buildFromHistories(List<List<Integer>> histories) {
        for (List<Integer> history : histories) {
            for (int i = 0; i < history.size(); i++) {
                for (int j = i + 1; j < history.size(); j++) {
                    addEdge(history.get(i), history.get(j));
                }
            }
        }
    }

    /**
     * Returns the neighbors of a content node sorted by co-watch weight (descending).
     * Useful for content-based similarity.
     *
     * @return list of [neighborId, weight] pairs
     */
    public List<int[]> getNeighborsSorted(int contentId) {
        Map<Integer, Integer> nbrs = adjacency.getOrDefault(contentId, Collections.emptyMap());
        List<int[]> result = new ArrayList<>();
        for (Map.Entry<Integer, Integer> e : nbrs.entrySet()) {
            result.add(new int[]{e.getKey(), e.getValue()});
        }
        result.sort((x, y) -> y[1] - x[1]); // descending by weight
        return result;
    }

    /** All node IDs in the graph (sorted) */
    public Set<Integer> getNodes() {
        return new TreeSet<>(adjacency.keySet());
    }

    /** Full adjacency map (read-only view) */
    public Map<Integer, Map<Integer, Integer>> getAdjacency() {
        return Collections.unmodifiableMap(adjacency);
    }

    /**
     * Returns all unique edges as {source, target, weight} int arrays.
     * Each undirected edge appears exactly once (source < target).
     */
    public List<int[]> getEdges() {
        List<int[]> edges = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        for (int a : new TreeSet<>(adjacency.keySet())) {
            for (Map.Entry<Integer, Integer> e : adjacency.get(a).entrySet()) {
                int b = e.getKey();
                if (a < b) {
                    String key = a + "-" + b;
                    if (seen.add(key)) {
                        edges.add(new int[]{a, b, e.getValue()});
                    }
                }
            }
        }
        return edges;
    }

    /** Returns node degree (number of distinct co-watched items) */
    public int degree(int contentId) {
        return adjacency.getOrDefault(contentId, Collections.emptyMap()).size();
    }
}
