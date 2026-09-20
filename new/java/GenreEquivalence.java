import java.util.*;

/**
 * DMGT Concept: Genre Equivalence Classes using Union-Find (Disjoint Set Union)
 * 
 * Genres are grouped into equivalence classes based on content similarity.
 * Uses path compression and union by rank for near-O(1) operations.
 * 
 * Equivalence relation defined:
 *   Action ~ Thriller  (both high-intensity)
 *   Drama  ~ Romance   (both character-driven)
 *   Sci-Fi ~ Horror    (both speculative/atmospheric)
 */
public class GenreEquivalence {
    private final int[] parent;
    private final int[] rank;
    private final String[] genres;

    public GenreEquivalence(String[] genres) {
        this.genres = genres;
        int n = genres.length;
        parent = new int[n];
        rank   = new int[n];
        // Initially every genre is its own equivalence class
        for (int i = 0; i < n; i++) parent[i] = i;
    }

    /** Find with path compression */
    public int find(int x) {
        if (parent[x] != x) parent[x] = find(parent[x]); // path compression
        return parent[x];
    }

    /** Union by rank – merges two genres into the same equivalence class */
    public void union(int x, int y) {
        int px = find(x), py = find(y);
        if (px == py) return; // already in the same class
        if (rank[px] < rank[py]) { int tmp = px; px = py; py = tmp; }
        parent[py] = px;
        if (rank[px] == rank[py]) rank[px]++;
    }

    /** Returns the representative (root) of the equivalence class for genre index i */
    public int getClass(int i) { return find(i); }

    /** Returns the genre name by index */
    public String getGenre(int index) { return genres[index]; }

    /** Number of genres */
    public int size() { return genres.length; }

    /**
     * Returns a map: classRoot -> list of genres in that equivalence class.
     * Used by Main.java to write the genreClasses section of processed_data.json.
     */
    public Map<Integer, List<String>> getEquivalenceClasses() {
        Map<Integer, List<String>> map = new TreeMap<>();
        for (int i = 0; i < genres.length; i++) {
            int cls = find(i);
            map.computeIfAbsent(cls, k -> new ArrayList<>()).add(genres[i]);
        }
        return map;
    }

    /** Returns the equivalence class index (0-based label) for a genre name */
    public int getClassByName(String genre) {
        for (int i = 0; i < genres.length; i++) {
            if (genres[i].equals(genre)) return find(i);
        }
        return -1;
    }
}
