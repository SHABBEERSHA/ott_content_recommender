import java.io.*;
import java.util.*;

/**
 * OTT Content Recommender – Java Data Processor
 * ══════════════════════════════════════════════
 * Orchestrates the academic concepts and writes processed_data.json
 * which is then consumed by the Python k-NN recommendation engine.
 *
 * Pipeline:
 *   1. OOPJ  – Define Content and User objects
 *   2. DMGT  – Build genre equivalence classes (Union-Find)
 *   3. ADSA  – Build co-watch graph (weighted adjacency list)
 *   4. Output → processed_data.json
 */
public class Main {

    public static void main(String[] args) throws IOException {
        System.out.println("╔══════════════════════════════════════════╗");
        System.out.println("║  OTT Content Recommender – Java Engine   ║");
        System.out.println("╚══════════════════════════════════════════╝");

        // ── 1. OOPJ: Build Content & User objects ─────────────────────────────
        List<WatchHistoryProcessor.Content> contentList = buildContentList();
        List<WatchHistoryProcessor.User>    users       = buildUsers();
        System.out.println("✓ [OOPJ] Loaded " + contentList.size() + " content items, "
                           + users.size() + " users.");

        // ── 2. DMGT: Genre Equivalence Classes (Union-Find) ───────────────────
        String[] genres = {"Action", "Thriller", "Drama", "Romance", "Sci-Fi", "Horror"};
        GenreEquivalence ge = new GenreEquivalence(genres);
        // Define equivalence relations:
        ge.union(0, 1); // Action ≡ Thriller  (both high-intensity)
        ge.union(2, 3); // Drama  ≡ Romance   (both character-driven)
        ge.union(4, 5); // Sci-Fi ≡ Horror    (both speculative/atmospheric)

        Map<Integer, List<String>> eqClasses = ge.getEquivalenceClasses();
        System.out.println("✓ [DMGT] Genre equivalence classes formed: " + eqClasses.size());
        int ci = 0;
        for (Map.Entry<Integer, List<String>> e : eqClasses.entrySet()) {
            System.out.println("  Class-" + ci++ + ": " + e.getValue());
        }

        // ── 3. ADSA: Co-Watch Graph ────────────────────────────────────────────
        CoWatchGraph graph = new CoWatchGraph();
        List<List<Integer>> histories = new ArrayList<>();
        for (WatchHistoryProcessor.User u : users) histories.add(u.getWatchedIds());
        graph.buildFromHistories(histories);
        System.out.println("✓ [ADSA] Co-watch graph: "
                           + graph.getNodes().size() + " nodes, "
                           + graph.getEdges().size() + " edges.");

        // ── 4. Write processed_data.json ──────────────────────────────────────
        StringBuilder json = new StringBuilder("{\n");

        // content array
        json.append("  \"content\": [\n");
        for (int i = 0; i < contentList.size(); i++) {
            json.append("    ").append(contentList.get(i).toJSON());
            if (i < contentList.size() - 1) json.append(",");
            json.append("\n");
        }
        json.append("  ],\n");

        // users array
        json.append("  \"users\": [\n");
        for (int i = 0; i < users.size(); i++) {
            json.append("    ").append(users.get(i).toJSON());
            if (i < users.size() - 1) json.append(",");
            json.append("\n");
        }
        json.append("  ],\n");

        // co-watch graph
        json.append("  \"coWatchGraph\": {\n    \"nodes\": [");
        List<Integer> nodes = new ArrayList<>(graph.getNodes());
        for (int i = 0; i < nodes.size(); i++) {
            if (i > 0) json.append(",");
            json.append(nodes.get(i));
        }
        json.append("],\n    \"edges\": [\n");
        List<int[]> edges = graph.getEdges();
        for (int i = 0; i < edges.size(); i++) {
            int[] e = edges.get(i);
            json.append("      {\"source\":").append(e[0])
                .append(",\"target\":").append(e[1])
                .append(",\"weight\":").append(e[2]).append("}");
            if (i < edges.size() - 1) json.append(",");
            json.append("\n");
        }
        json.append("    ]\n  },\n");

        // genre equivalence classes
        String[] classLabels = {
            "Action & Suspense",
            "Drama & Emotion",
            "Speculative & Atmosphere"
        };
        String[] classDescs = {
            "High-intensity content with action sequences or psychological tension",
            "Character-driven narratives exploring human relationships and emotions",
            "Imaginative worlds and atmospheric storytelling that challenge reality"
        };
        json.append("  \"genreClasses\": [\n");
        List<Map.Entry<Integer, List<String>>> classList = new ArrayList<>(eqClasses.entrySet());
        for (int i = 0; i < classList.size(); i++) {
            List<String> gs = classList.get(i).getValue();
            json.append("    {\"class\":").append(i)
                .append(",\"genres\":[");
            for (int j = 0; j < gs.size(); j++) {
                if (j > 0) json.append(",");
                json.append("\"").append(gs.get(j)).append("\"");
            }
            json.append("],\"label\":\"").append(classLabels[Math.min(i, classLabels.length - 1)]).append("\"")
                .append(",\"description\":\"").append(classDescs[Math.min(i, classDescs.length - 1)]).append("\"}");
            if (i < classList.size() - 1) json.append(",");
            json.append("\n");
        }
        json.append("  ]\n}\n");

        // Determine output path: write to parent dir if running from java/,
        // otherwise write to current dir.
        String outPath = new File("processed_data.json").exists()
                         ? "processed_data.json"
                         : "../processed_data.json";
        try (FileWriter fw = new FileWriter(outPath)) {
            fw.write(json.toString());
        }
        System.out.println("✓ Written: " + new File(outPath).getAbsolutePath());
        System.out.println("╔══════════════════════════════════════════╗");
        System.out.println("║  Done. Python server can now start.      ║");
        System.out.println("╚══════════════════════════════════════════╝");
    }

    // ── Sample data ────────────────────────────────────────────────────────────

    private static List<WatchHistoryProcessor.Content> buildContentList() {
        List<WatchHistoryProcessor.Content> L = new ArrayList<>();
        L.add(new WatchHistoryProcessor.Content(1,"Avengers: Endgame","Action",2019,8.4,
            "The Avengers assemble for one final battle against Thanos to restore half the universe.",
            "\"superhero\",\"epic\",\"action\"","181 min"));
        L.add(new WatchHistoryProcessor.Content(2,"John Wick","Action",2014,7.4,
            "An ex-hitman comes out of retirement to track down the gangsters that took everything from him.",
            "\"action\",\"thriller\",\"revenge\"","101 min"));
        L.add(new WatchHistoryProcessor.Content(3,"Mad Max: Fury Road","Action",2015,8.1,
            "In a post-apocalyptic wasteland, a woman rebels against a tyrannical ruler alongside a drifter.",
            "\"action\",\"post-apocalyptic\",\"adventure\"","120 min"));
        L.add(new WatchHistoryProcessor.Content(4,"Top Gun: Maverick","Action",2022,8.3,
            "After thirty years, Maverick is still pushing the envelope as a top naval aviator.",
            "\"action\",\"drama\",\"military\"","130 min"));
        L.add(new WatchHistoryProcessor.Content(5,"Gone Girl","Thriller",2014,8.1,
            "With his wife disappearance having become the focus of an intense media circus, a man catches suspicion.",
            "\"thriller\",\"mystery\",\"dark\"","149 min"));
        L.add(new WatchHistoryProcessor.Content(6,"Inception","Thriller",2010,8.8,
            "A thief who steals corporate secrets through dream-sharing technology is given the inverse task of planting an idea.",
            "\"thriller\",\"sci-fi\",\"mind-bending\"","148 min"));
        L.add(new WatchHistoryProcessor.Content(7,"Parasite","Thriller",2019,8.5,
            "A poor family schemes to become employed by a wealthy family by infiltrating their household.",
            "\"thriller\",\"drama\",\"social\"","132 min"));
        L.add(new WatchHistoryProcessor.Content(8,"Knives Out","Thriller",2019,7.9,
            "A detective investigates the death of the patriarch of an eccentric, combative family.",
            "\"thriller\",\"mystery\",\"comedy\"","130 min"));
        L.add(new WatchHistoryProcessor.Content(9,"Breaking Bad","Drama",2008,9.5,
            "A chemistry teacher diagnosed with cancer turns to manufacturing drugs to secure his family future.",
            "\"drama\",\"crime\",\"intense\"","TV Series"));
        L.add(new WatchHistoryProcessor.Content(10,"Succession","Drama",2018,8.8,
            "The Roy family controls one of the biggest media empires in the world while fighting for control.",
            "\"drama\",\"family\",\"power\"","TV Series"));
        L.add(new WatchHistoryProcessor.Content(11,"The Crown","Drama",2016,8.7,
            "Follows the political rivalries and romance of Queen Elizabeth II reign.",
            "\"drama\",\"history\",\"royalty\"","TV Series"));
        L.add(new WatchHistoryProcessor.Content(12,"Ozark","Drama",2017,8.4,
            "A financial advisor drags his family from Chicago to the Ozarks, where he must launder money.",
            "\"drama\",\"crime\",\"thriller\"","TV Series"));
        L.add(new WatchHistoryProcessor.Content(13,"Blade Runner 2049","Sci-Fi",2017,8.0,
            "Young Blade Runner K's discovery of a long-buried secret leads him to track down former Blade Runner Rick Deckard.",
            "\"sci-fi\",\"cyberpunk\",\"mystery\"","164 min"));
        L.add(new WatchHistoryProcessor.Content(14,"The Matrix","Sci-Fi",1999,8.7,
            "A computer hacker learns about the true nature of his reality and his role in the war against its controllers.",
            "\"sci-fi\",\"action\",\"mind-bending\"","136 min"));
        L.add(new WatchHistoryProcessor.Content(15,"Arrival","Sci-Fi",2016,7.9,
            "A linguist works with the military to communicate with alien lifeforms after mysterious spacecraft appear.",
            "\"sci-fi\",\"drama\",\"linguistics\"","116 min"));
        L.add(new WatchHistoryProcessor.Content(16,"Dune","Sci-Fi",2021,8.0,
            "The son of a noble family is entrusted with the protection of the most valuable asset in the galaxy.",
            "\"sci-fi\",\"epic\",\"fantasy\"","155 min"));
        L.add(new WatchHistoryProcessor.Content(17,"Get Out","Horror",2017,7.7,
            "A young man visits his girlfriend parents where his senses become more and more heightened with unease.",
            "\"horror\",\"thriller\",\"social\"","104 min"));
        L.add(new WatchHistoryProcessor.Content(18,"A Quiet Place","Horror",2018,7.5,
            "In a post-apocalyptic world, a family is forced to live in near silence while hiding from creatures.",
            "\"horror\",\"survival\",\"family\"","90 min"));
        L.add(new WatchHistoryProcessor.Content(19,"La La Land","Romance",2016,8.0,
            "While navigating their careers in Los Angeles, a pianist and an actress fall in love.",
            "\"romance\",\"musical\",\"drama\"","128 min"));
        L.add(new WatchHistoryProcessor.Content(20,"About Time","Romance",2013,7.8,
            "At the age of 21, Tim discovers he can travel in time and change what happens in his own life.",
            "\"romance\",\"drama\",\"time-travel\"","123 min"));
        return L;
    }

    private static List<WatchHistoryProcessor.User> buildUsers() {
        List<WatchHistoryProcessor.User> L = new ArrayList<>();
        L.add(new WatchHistoryProcessor.User(1,"Alice", Arrays.asList(
            new WatchHistoryProcessor.WatchRecord(1,5), new WatchHistoryProcessor.WatchRecord(2,4),
            new WatchHistoryProcessor.WatchRecord(3,4), new WatchHistoryProcessor.WatchRecord(6,5),
            new WatchHistoryProcessor.WatchRecord(5,3))));
        L.add(new WatchHistoryProcessor.User(2,"Bob", Arrays.asList(
            new WatchHistoryProcessor.WatchRecord(13,5), new WatchHistoryProcessor.WatchRecord(16,4),
            new WatchHistoryProcessor.WatchRecord(14,5), new WatchHistoryProcessor.WatchRecord(15,4),
            new WatchHistoryProcessor.WatchRecord(6,3))));
        L.add(new WatchHistoryProcessor.User(3,"Carol", Arrays.asList(
            new WatchHistoryProcessor.WatchRecord(9,5), new WatchHistoryProcessor.WatchRecord(10,4),
            new WatchHistoryProcessor.WatchRecord(12,5), new WatchHistoryProcessor.WatchRecord(5,3),
            new WatchHistoryProcessor.WatchRecord(8,4))));
        L.add(new WatchHistoryProcessor.User(4,"Dave", Arrays.asList(
            new WatchHistoryProcessor.WatchRecord(1,4), new WatchHistoryProcessor.WatchRecord(4,5),
            new WatchHistoryProcessor.WatchRecord(2,3), new WatchHistoryProcessor.WatchRecord(16,3),
            new WatchHistoryProcessor.WatchRecord(13,4))));
        L.add(new WatchHistoryProcessor.User(5,"Eve", Arrays.asList(
            new WatchHistoryProcessor.WatchRecord(19,5), new WatchHistoryProcessor.WatchRecord(20,5),
            new WatchHistoryProcessor.WatchRecord(11,4), new WatchHistoryProcessor.WatchRecord(10,3))));
        L.add(new WatchHistoryProcessor.User(6,"Frank", Arrays.asList(
            new WatchHistoryProcessor.WatchRecord(17,5), new WatchHistoryProcessor.WatchRecord(18,4),
            new WatchHistoryProcessor.WatchRecord(15,3), new WatchHistoryProcessor.WatchRecord(16,4),
            new WatchHistoryProcessor.WatchRecord(14,3))));
        L.add(new WatchHistoryProcessor.User(7,"Grace", Arrays.asList(
            new WatchHistoryProcessor.WatchRecord(7,5), new WatchHistoryProcessor.WatchRecord(8,4),
            new WatchHistoryProcessor.WatchRecord(5,5), new WatchHistoryProcessor.WatchRecord(9,4),
            new WatchHistoryProcessor.WatchRecord(12,3))));
        L.add(new WatchHistoryProcessor.User(8,"Hank", Arrays.asList(
            new WatchHistoryProcessor.WatchRecord(1,5), new WatchHistoryProcessor.WatchRecord(3,4),
            new WatchHistoryProcessor.WatchRecord(4,4), new WatchHistoryProcessor.WatchRecord(2,5),
            new WatchHistoryProcessor.WatchRecord(13,3))));
        L.add(new WatchHistoryProcessor.User(9,"Ivy", Arrays.asList(
            new WatchHistoryProcessor.WatchRecord(6,5), new WatchHistoryProcessor.WatchRecord(7,4),
            new WatchHistoryProcessor.WatchRecord(17,3), new WatchHistoryProcessor.WatchRecord(13,4),
            new WatchHistoryProcessor.WatchRecord(15,5))));
        L.add(new WatchHistoryProcessor.User(10,"Jake", Arrays.asList(
            new WatchHistoryProcessor.WatchRecord(11,5), new WatchHistoryProcessor.WatchRecord(19,4),
            new WatchHistoryProcessor.WatchRecord(20,3), new WatchHistoryProcessor.WatchRecord(10,5),
            new WatchHistoryProcessor.WatchRecord(9,4))));
        return L;
    }
}
