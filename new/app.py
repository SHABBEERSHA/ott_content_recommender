"""
OTT Content Recommender - Python k-NN Engine
============================================
Loads the data produced by the Java processor and serves:
  - Personalized recommendations via k-NN collaborative filtering
  - Co-watch graph data for D3 visualization
  - Genre equivalence classes for D3 visualization
  - Static frontend files (index.html, style.css, app.js)

k-NN Algorithm (cosine similarity):
  1. Represent each user as a rating vector {content_id: rating}
  2. Compute cosine similarity between target user and all others
  3. Select top-k most similar users (nearest neighbors)
  4. Weighted-sum their unwatched ratings  →  recommendation scores
  5. Return ranked list with explanation reasons
"""

try:
    from flask import Flask, jsonify, request, send_from_directory
except ModuleNotFoundError:
    import subprocess
    import sys
    subprocess.check_call([sys.executable, "-m", "pip", "install", "flask"])
    from flask import Flask, jsonify, request, send_from_directory
import json, math, os

app = Flask(__name__, static_folder='.')

# ── Load data produced by Java ────────────────────────────────────────────────
_base = os.path.dirname(os.path.abspath(__file__))
with open(os.path.join(_base, 'processed_data.json'), 'r', encoding='utf-8') as f:
    DATA = json.load(f)

CONTENT_MAP   = {c['id']: c for c in DATA['content']}
USERS         = DATA['users']
GENRE_CLASSES = DATA['genreClasses']

# Build genre → equivalence class label lookup
GENRE_TO_CLASS = {}
for gc in GENRE_CLASSES:
    for g in gc['genres']:
        GENRE_TO_CLASS[g] = gc['label']

# ── k-NN Helper Functions ─────────────────────────────────────────────────────

def cosine_similarity(v1: dict, v2: dict) -> float:
    """
    Cosine similarity between two rating vectors (sparse dicts).
    sim(u,v) = (u · v) / (|u| * |v|)
    Returns 0.0 if either vector is zero or they share no common items.
    """
    common = set(v1) & set(v2)
    if not common:
        return 0.0
    dot  = sum(v1[k] * v2[k] for k in common)
    mag1 = math.sqrt(sum(x * x for x in v1.values()))
    mag2 = math.sqrt(sum(x * x for x in v2.values()))
    return dot / (mag1 * mag2) if mag1 and mag2 else 0.0


def build_reason(rec_genre: str, watched_genres: set) -> str:
    """Determine why this item is being recommended (for UI display)."""
    if rec_genre in watched_genres:
        return f"Because you watched {rec_genre}"
    rec_class   = GENRE_TO_CLASS.get(rec_genre, '')
    peer_classes = {GENRE_TO_CLASS.get(g, '') for g in watched_genres}
    if rec_class and rec_class in peer_classes:
        return f"In your \"{rec_class}\" taste class"
    return "Trending among similar users"


# ── API Routes ────────────────────────────────────────────────────────────────

@app.route('/api/recommend')
def recommend():
    """
    GET /api/recommend?user=<id>&k=<k>
    Runs k-NN collaborative filtering and returns ranked recommendations.
    """
    user_id = int(request.args.get('user', 1))
    k       = max(1, min(int(request.args.get('k', 5)), len(USERS) - 1))

    # Find target user
    target = next((u for u in USERS if u['id'] == user_id), None)
    if not target:
        return jsonify({'error': 'User not found'}), 404

    # Step 1 – Build target rating vector
    target_vec   = {h['contentId']: h['rating'] for h in target['history']}
    watched_ids  = set(target_vec)
    watched_genres = {CONTENT_MAP[cid]['genre'] for cid in watched_ids if cid in CONTENT_MAP}

    # Step 2 – Compute cosine similarity with every other user
    similarities = []
    for u in USERS:
        if u['id'] == user_id:
            continue
        other_vec = {h['contentId']: h['rating'] for h in u['history']}
        sim = cosine_similarity(target_vec, other_vec)
        similarities.append({
            'userId':   u['id'],
            'userName': u['name'],
            'similarity': round(sim, 4),
            'vector':   other_vec
        })

    # Step 3 – Pick top-k nearest neighbors
    similarities.sort(key=lambda x: x['similarity'], reverse=True)
    neighbors = similarities[:k]

    # Step 4 – Weighted aggregation of neighbor ratings
    scores = {}
    for nb in neighbors:
        sim = nb['similarity']
        if sim <= 0:
            continue
        for cid, rating in nb['vector'].items():
            if cid not in watched_ids:
                scores[cid] = scores.get(cid, 0.0) + sim * rating

    # Step 5 – Rank and annotate
    max_score = max(scores.values(), default=1)
    ranked    = sorted(scores.items(), key=lambda x: x[1], reverse=True)[:10]

    recommendations = []
    for cid, score in ranked:
        c = CONTENT_MAP.get(cid)
        if not c:
            continue
        rec_by = [nb['userName'] for nb in neighbors if cid in nb['vector']]
        recommendations.append({
            **c,
            'score':      round(score, 4),
            'matchPct':   min(99, max(70, int(score / max_score * 99))),
            'reason':     build_reason(c['genre'], watched_genres),
            'recommendedBy': rec_by
        })

    return jsonify({
        'userId':          user_id,
        'userName':        target['name'],
        'recommendations': recommendations,
        'knnSteps': {
            'targetVector':    {str(k): v for k, v in target_vec.items()},
            'allSimilarities': [
                {'userId': s['userId'], 'userName': s['userName'], 'similarity': s['similarity']}
                for s in similarities
            ],
            'neighbors': [
                {'userId': n['userId'], 'userName': n['userName'], 'similarity': n['similarity']}
                for n in neighbors
            ],
            'totalCandidates': len(scores),
            'k': k
        }
    })


@app.route('/api/content')
def get_content():
    """GET /api/content – All 20 content items."""
    return jsonify(DATA['content'])


@app.route('/api/graph')
def get_graph():
    """GET /api/graph – Co-watch graph (nodes + weighted edges)."""
    return jsonify(DATA['coWatchGraph'])


@app.route('/api/genres')
def get_genres():
    """GET /api/genres – Genre equivalence classes."""
    return jsonify(GENRE_CLASSES)


@app.route('/api/users')
def get_users():
    """GET /api/users – User list (id, name, watchedCount)."""
    return jsonify([
        {'id': u['id'], 'name': u['name'], 'watchedCount': len(u['history'])}
        for u in USERS
    ])


@app.route('/')
def index():
    return send_from_directory(_base, 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory(_base, path)


# ── Entry Point ───────────────────────────────────────────────────────────────
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    print("=" * 52)
    print("  OTT CONTENT RECOMMENDER - Python k-NN Engine")
    print("  DMGT + ADSA + OOPJ + Python k-NN")
    print("=" * 52)
    print(f"  Content items : {len(DATA['content'])}")
    print(f"  Users         : {len(USERS)}")
    print(f"  Graph edges   : {len(DATA['coWatchGraph']['edges'])}")
    print(f"  Genre classes : {len(GENRE_CLASSES)}")
    print("-" * 50)
    print(f"  Open http://localhost:{port} in your browser")
    print("  Press Ctrl+C to stop")
    print("=" * 50)
    app.run(debug=False, port=port, host='0.0.0.0')
