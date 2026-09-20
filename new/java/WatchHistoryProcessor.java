import java.util.*;

/**
 * OOPJ Concept: Java data models for OTT content processing.
 *
 * Demonstrates core OOP principles:
 *   - Encapsulation  : all fields are final; access via methods only
 *   - Abstraction    : Content and User hide storage details behind clean APIs
 *   - Inner classes  : WatchRecord is a value-type nested class
 *
 * This class also contains the logic to build the user-content rating matrix,
 * which is then consumed by the Python k-NN engine.
 */
public class WatchHistoryProcessor {

    // ─────────────────────────────────────────────────────────────────────────
    // Inner class: Content
    // ─────────────────────────────────────────────────────────────────────────

    /** Immutable representation of a movie or TV show */
    public static class Content {
        public final int    id;
        public final String title;
        public final String genre;
        public final int    year;
        public final double rating;
        public final String description;
        public final String tagsJson;   // pre-formatted JSON array string
        public final String duration;

        public Content(int id, String title, String genre, int year,
                       double rating, String description, String tagsJson, String duration) {
            this.id          = id;
            this.title       = title;
            this.genre       = genre;
            this.year        = year;
            this.rating      = rating;
            this.description = description;
            this.tagsJson    = tagsJson;
            this.duration    = duration;
        }

        /** Serialise to a JSON object string */
        public String toJSON() {
            return String.format(
                "{\"id\":%d,\"title\":\"%s\",\"genre\":\"%s\",\"year\":%d," +
                "\"rating\":%.1f,\"description\":\"%s\",\"tags\":[%s],\"duration\":\"%s\"}",
                id, escapeJSON(title), genre, year,
                rating, escapeJSON(description), tagsJson, duration);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Inner class: WatchRecord
    // ─────────────────────────────────────────────────────────────────────────

    /** A single item in a user's watch history with an explicit star rating */
    public static class WatchRecord {
        public final int contentId;
        public final int rating;     // 1-5 stars

        public WatchRecord(int contentId, int rating) {
            this.contentId = contentId;
            this.rating    = rating;
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Inner class: User
    // ─────────────────────────────────────────────────────────────────────────

    /** A streaming platform user with their complete watch history */
    public static class User {
        public final int              id;
        public final String           name;
        public final List<WatchRecord> history;

        public User(int id, String name, List<WatchRecord> history) {
            this.id      = id;
            this.name    = name;
            this.history = Collections.unmodifiableList(history);
        }

        /**
         * Returns the list of content IDs this user has watched.
         * Used by CoWatchGraph to build co-watch edges.
         */
        public List<Integer> getWatchedIds() {
            List<Integer> ids = new ArrayList<>();
            for (WatchRecord r : history) ids.add(r.contentId);
            return ids;
        }

        /**
         * Returns this user's rating vector as {contentId → rating}.
         * Used by Python k-NN as the feature vector for collaborative filtering.
         */
        public Map<Integer, Integer> getRatingVector() {
            Map<Integer, Integer> vec = new HashMap<>();
            for (WatchRecord r : history) vec.put(r.contentId, r.rating);
            return vec;
        }

        /** Serialise to a JSON object string */
        public String toJSON() {
            StringBuilder sb = new StringBuilder();
            sb.append(String.format("{\"id\":%d,\"name\":\"%s\",\"history\":[", id, name));
            for (int i = 0; i < history.size(); i++) {
                if (i > 0) sb.append(",");
                WatchRecord r = history.get(i);
                sb.append(String.format("{\"contentId\":%d,\"rating\":%d}", r.contentId, r.rating));
            }
            sb.append("]}");
            return sb.toString();
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Utility
    // ─────────────────────────────────────────────────────────────────────────

    /** Escapes double-quotes and backslashes for embedding in a JSON string */
    static String escapeJSON(String s) {
        return s.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}
