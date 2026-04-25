// ===== FIREBASE CONFIG =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, collection, doc, getDocs, addDoc, updateDoc, deleteDoc, query, orderBy, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCfo0V01Psld9dBDc6FNkWZIyee_X8PCqQ",
  authDomain: "learning-ielts-bfe75.firebaseapp.com",
  projectId: "learning-ielts-bfe75",
  storageBucket: "learning-ielts-bfe75.firebasestorage.app",
  messagingSenderId: "767542157541",
  appId: "1:767542157541:web:607e1339ce5ab122bd740c"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ===== DEFAULT TOPICS =====
const DEFAULT_TOPICS = [
  { name: "Hometown", emoji: "🏘️" },
  { name: "Work/Study", emoji: "💼" },
  { name: "Family", emoji: "👨‍👩‍👧" },
  { name: "Hobbies", emoji: "🎨" },
  { name: "Technology", emoji: "💻" },
  { name: "Travel", emoji: "✈️" },
  { name: "Food", emoji: "🍜" },
  { name: "Health", emoji: "🏥" },
  { name: "Education", emoji: "📚" },
  { name: "Environment", emoji: "🌿" },
  { name: "Shopping", emoji: "🛍️" },
  { name: "Music", emoji: "🎵" },
  { name: "Social Media", emoji: "📱" },
  { name: "Festivals", emoji: "🎉" },
  { name: "Future Plans", emoji: "🚀" },
  { name: "Crime", emoji: "⚖️" },
  { name: "Transport", emoji: "🚇" },
  { name: "Society", emoji: "🌐" },
  { name: "Sports", emoji: "⚽" },
  { name: "Reading", emoji: "📖" },
  { name: "Business & Money", emoji: "💰" },
  { name: "Economics", emoji: "📈" },
  { name: "Art", emoji: "🎭" },
];

// ===== APP STATE =====
let currentTab = 'speaking';
let currentTopicId = null;
let currentTopicName = '';
let currentPart = 1;
let allTopics = [];
let currentQuestions = [];
let generatedAIQuestions = [];
let selectedAIQuestions = new Set();

// ===== INIT =====
document.addEventListener('DOMContentLoaded', async () => {
  // Theme
  const savedTheme = localStorage.getItem('ielts-theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);

  // Load settings
  const savedKey = localStorage.getItem('deepseek-api-key');
  if (savedKey) document.getElementById('settings-deepseek-key').value = savedKey;

  // Load topics
  await loadTopics();
});

// ===== THEME =====
window.toggleTheme = () => {
  const html = document.documentElement;
  const current = html.getAttribute('data-theme');
  const next = current === 'light' ? 'dark' : 'light';
  html.setAttribute('data-theme', next);
  localStorage.setItem('ielts-theme', next);
};

// ===== TAB SWITCHING =====
window.switchTab = (tab) => {
  // Remove active from all nav items
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  document.getElementById(`nav-${tab}`).classList.add('active');

  // Hide all tab content
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.getElementById(`tab-${tab}`).classList.add('active');

  currentTab = tab;
};

// ===== FIREBASE: LOAD TOPICS =====
async function loadTopics() {
  const grid = document.getElementById('topicsGrid');
  grid.innerHTML = '<div class="topics-loading"><div class="spinner"></div><p>Loading topics...</p></div>';

  try {
    const topicsRef = collection(db, 'topics');
    const snapshot = await getDocs(query(topicsRef, orderBy('createdAt')));

    if (snapshot.empty) {
      // Seed default topics
      await seedDefaultTopics();
      return;
    }

    allTopics = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    renderTopics();
  } catch (err) {
    console.error('Error loading topics:', err);
    grid.innerHTML = '<div class="empty-state"><div class="empty-state-icon">⚠️</div><h3>Connection Error</h3><p>Check your Firebase configuration</p></div>';
  }
}

async function seedDefaultTopics() {
  try {
    const topicsRef = collection(db, 'topics');
    for (const topic of DEFAULT_TOPICS) {
      await addDoc(topicsRef, {
        name: topic.name,
        emoji: topic.emoji,
        createdAt: Date.now(),
        part1: { answered: 0, total: 0 },
        part2: { answered: 0, total: 0 },
        part3: { answered: 0, total: 0 },
      });
    }
    await loadTopics();
  } catch (err) {
    console.error('Seed error:', err);
  }
}

// ===== RENDER TOPICS =====
function renderTopics() {
  const grid = document.getElementById('topicsGrid');

  if (allTopics.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <div class="empty-state-icon">📝</div>
        <h3>No topics yet</h3>
        <p>Create your first speaking topic to get started</p>
      </div>`;
    return;
  }

  grid.innerHTML = allTopics.map(topic => {
    const p1 = topic.part1 || { answered: 0, total: 0 };
    const p2 = topic.part2 || { answered: 0, total: 0 };
    const p3 = topic.part3 || { answered: 0, total: 0 };

    const pct1 = p1.total > 0 ? (p1.answered / p1.total) * 100 : 0;
    const pct2 = p2.total > 0 ? (p2.answered / p2.total) * 100 : 0;
    const pct3 = p3.total > 0 ? (p3.answered / p3.total) * 100 : 0;

    return `
      <div class="topic-card" onclick="openTopic('${topic.id}', '${escapeAttr(topic.name)}')">
        <div class="topic-card-header">
          <span class="topic-name">${escapeHtml(topic.name)}</span>
          <span class="topic-emoji">${topic.emoji || '📝'}</span>
        </div>
        <div class="topic-progress">
          <div class="progress-row">
            <div class="progress-label-row">
              <span class="progress-part">Part 1</span>
              <span class="progress-fraction">${p1.answered} / ${p1.total}</span>
            </div>
            <div class="progress-bar-track">
              <div class="progress-bar-fill part1" style="width:${pct1}%"></div>
            </div>
          </div>
          <div class="progress-row">
            <div class="progress-label-row">
              <span class="progress-part">Part 2</span>
              <span class="progress-fraction">${p2.answered} / ${p2.total}</span>
            </div>
            <div class="progress-bar-track">
              <div class="progress-bar-fill part2" style="width:${pct2}%"></div>
            </div>
          </div>
          <div class="progress-row">
            <div class="progress-label-row">
              <span class="progress-part">Part 3</span>
              <span class="progress-fraction">${p3.answered} / ${p3.total}</span>
            </div>
            <div class="progress-bar-track">
              <div class="progress-bar-fill part3" style="width:${pct3}%"></div>
            </div>
          </div>
        </div>
      </div>`;
  }).join('');
}

// ===== OPEN TOPIC =====
window.openTopic = (topicId, topicName) => {
  currentTopicId = topicId;
  currentTopicName = decodeURIComponent(topicName);
  currentPart = 1;

  document.getElementById('view-topics').classList.add('hidden');
  document.getElementById('view-topic-detail').classList.remove('hidden');
  document.getElementById('detail-topic-name').textContent = currentTopicName;

  // Reset part tabs
  document.querySelectorAll('.part-tab').forEach((t, i) => {
    t.classList.toggle('active', i === 0);
  });

  loadQuestions();
};

window.goBackToTopics = async () => {
  document.getElementById('view-topics').classList.remove('hidden');
  document.getElementById('view-topic-detail').classList.add('hidden');
  currentTopicId = null;
  currentQuestions = [];
  await loadTopics();
};

// ===== SWITCH PART =====
window.switchPart = (part) => {
  currentPart = part;
  document.querySelectorAll('.part-tab').forEach((t, i) => {
    t.classList.toggle('active', i === part - 1);
  });
  loadQuestions();
};

// ===== LOAD QUESTIONS =====
async function loadQuestions() {
  const list = document.getElementById('questionsList');
  list.innerHTML = '<div class="topics-loading"><div class="spinner"></div><p>Loading questions...</p></div>';

  try {
    const qRef = collection(db, 'topics', currentTopicId, `part${currentPart}`);
    const snapshot = await getDocs(query(qRef, orderBy('createdAt')));
    currentQuestions = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

    // Update part tab counts
    await updatePartCounts();
    renderQuestions();
  } catch (err) {
    console.error('Error loading questions:', err);
    list.innerHTML = '<div class="empty-state"><span class="empty-state-icon">⚠️</span><h3>Error loading questions</h3></div>';
  }
}

async function updatePartCounts() {
  for (let p = 1; p <= 3; p++) {
    const qRef = collection(db, 'topics', currentTopicId, `part${p}`);
    const snap = await getDocs(qRef);
    const questions = snap.docs.map(d => d.data());
    const total = questions.length;
    const answered = questions.filter(q => q.answer && q.answer.trim()).length;

    document.getElementById(`part${p}-count`).textContent = `${answered} / ${total}`;
  }
}

// ===== RENDER QUESTIONS =====
function renderQuestions() {
  const list = document.getElementById('questionsList');
  const info = document.getElementById('questions-info');

  const answered = currentQuestions.filter(q => q.answer && q.answer.trim()).length;
  info.textContent = `${answered} / ${currentQuestions.length} answered`;

  if (currentQuestions.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">💬</div>
        <h3>No questions yet</h3>
        <p>Add questions manually or generate them with AI</p>
      </div>`;
    return;
  }

  list.innerHTML = currentQuestions.map((q, idx) => {
    const hasAnswer = q.answer && q.answer.trim();
    return `
      <div class="question-card ${hasAnswer ? 'answered-card' : ''}" id="qcard-${q.id}">
        <div class="question-header">
          <div class="question-number">${idx + 1}</div>
          <div class="question-text" id="qtext-${q.id}">${escapeHtml(q.question)}</div>
          <textarea class="question-edit-input" id="qedit-${q.id}" rows="2">${escapeHtml(q.question)}</textarea>
          <div class="question-actions">
            <button class="q-btn toggle-answer ${hasAnswer ? 'answered' : ''}" onclick="toggleAnswer('${q.id}')" title="${hasAnswer ? 'View answer' : 'No answer yet'}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            </button>
            <button class="q-btn edit-btn" onclick="toggleEdit('${q.id}')" title="Edit">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
              </svg>
            </button>
            <button class="q-btn save-btn hidden" id="save-btn-${q.id}" onclick="saveQuestion('${q.id}')" title="Save">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </button>
            <button class="q-btn delete-btn" onclick="deleteQuestion('${q.id}')" title="Delete">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14H6L5 6"/>
                <path d="M10 11v6M14 11v6"/>
                <path d="M9 6V4h6v2"/>
              </svg>
            </button>
          </div>
        </div>
        <div class="question-answer-wrapper" id="qanswer-${q.id}">
          <div class="answer-label">Your Answer</div>
          ${hasAnswer
        ? `<div class="answer-text" id="atext-${q.id}">${escapeHtml(q.answer)}</div>`
        : `<div class="answer-placeholder" id="atext-${q.id}">No answer yet. Click edit to add one.</div>`}
          <textarea class="answer-edit-textarea" id="aedit-${q.id}" rows="4" placeholder="Write your answer...">${escapeHtml(q.answer || '')}</textarea>
        </div>
      </div>`;
  }).join('');
}

// ===== TOGGLE ANSWER =====
window.toggleAnswer = (qId) => {
  const wrapper = document.getElementById(`qanswer-${qId}`);
  wrapper.classList.toggle('visible');
};

// ===== TOGGLE EDIT =====
window.toggleEdit = (qId) => {
  const qtext = document.getElementById(`qtext-${qId}`);
  const qedit = document.getElementById(`qedit-${qId}`);
  const atext = document.getElementById(`atext-${qId}`);
  const aedit = document.getElementById(`aedit-${qId}`);
  const saveBtn = document.getElementById(`save-btn-${qId}`);
  const answerWrapper = document.getElementById(`qanswer-${qId}`);

  const isEditing = qedit.classList.contains('visible');

  if (isEditing) {
    // Cancel edit
    qtext.classList.remove('editing');
    qedit.classList.remove('visible');
    if (atext) atext.style.display = '';
    aedit.classList.remove('visible');
    saveBtn.classList.add('hidden');
  } else {
    // Start edit
    qtext.classList.add('editing');
    qedit.classList.add('visible');
    answerWrapper.classList.add('visible');
    if (atext) atext.style.display = 'none';
    aedit.classList.add('visible');
    saveBtn.classList.remove('hidden');
    qedit.focus();
  }
};

// ===== SAVE QUESTION =====
window.saveQuestion = async (qId) => {
  const newQuestion = document.getElementById(`qedit-${qId}`).value.trim();
  const newAnswer = document.getElementById(`aedit-${qId}`).value.trim();

  if (!newQuestion) { showToast('Question cannot be empty', 'error'); return; }

  try {
    const qDoc = doc(db, 'topics', currentTopicId, `part${currentPart}`, qId);
    await updateDoc(qDoc, { question: newQuestion, answer: newAnswer, updatedAt: Date.now() });

    // Update topic part stats
    await syncTopicStats();

    showToast('Saved!', 'success');
    await loadQuestions();
  } catch (err) {
    console.error(err);
    showToast('Failed to save', 'error');
  }
};

// ===== DELETE QUESTION =====
window.deleteQuestion = async (qId) => {
  if (!confirm('Delete this question?')) return;
  try {
    await deleteDoc(doc(db, 'topics', currentTopicId, `part${currentPart}`, qId));
    await syncTopicStats();
    showToast('Deleted', 'success');
    await loadQuestions();
  } catch (err) {
    showToast('Failed to delete', 'error');
  }
};

// ===== SYNC TOPIC STATS =====
async function syncTopicStats() {
  try {
    const updates = {};
    for (let p = 1; p <= 3; p++) {
      const qRef = collection(db, 'topics', currentTopicId, `part${p}`);
      const snap = await getDocs(qRef);
      const questions = snap.docs.map(d => d.data());
      updates[`part${p}`] = {
        total: questions.length,
        answered: questions.filter(q => q.answer && q.answer.trim()).length,
      };
    }
    await updateDoc(doc(db, 'topics', currentTopicId), updates);
  } catch (err) {
    console.error('Sync stats error:', err);
  }
}

// ===== CREATE TOPIC =====
window.openCreateTopicModal = () => openModal('modal-create-topic');

window.createTopic = async () => {
  const name = document.getElementById('new-topic-name').value.trim();
  if (!name) { showToast('Please enter a topic name', 'error'); return; }

  const emojis = ['📝', '🌟', '💡', '🎯', '🔥', '✨', '🌈', '🎪'];
  const emoji = emojis[Math.floor(Math.random() * emojis.length)];

  try {
    await addDoc(collection(db, 'topics'), {
      name,
      emoji,
      createdAt: Date.now(),
      part1: { answered: 0, total: 0 },
      part2: { answered: 0, total: 0 },
      part3: { answered: 0, total: 0 },
    });
    closeModal('modal-create-topic');
    document.getElementById('new-topic-name').value = '';
    showToast(`Topic "${name}" created!`, 'success');
    await loadTopics();
  } catch (err) {
    showToast('Failed to create topic', 'error');
  }
};

// ===== ADD QUESTION =====
window.openAddQuestionModal = () => {
  document.getElementById('new-question-text').value = '';
  document.getElementById('new-question-answer').value = '';
  openModal('modal-add-question');
};

window.addQuestion = async () => {
  const question = document.getElementById('new-question-text').value.trim();
  const answer = document.getElementById('new-question-answer').value.trim();
  if (!question) { showToast('Please enter a question', 'error'); return; }

  try {
    const qRef = collection(db, 'topics', currentTopicId, `part${currentPart}`);
    await addDoc(qRef, { question, answer, createdAt: Date.now() });
    await syncTopicStats();
    closeModal('modal-add-question');
    showToast('Question added!', 'success');
    await loadQuestions();
  } catch (err) {
    showToast('Failed to add question', 'error');
  }
};

// ===== AI GENERATE =====
window.openAIModal = () => {
  document.getElementById('ai-topic-display').textContent = currentTopicName;
  document.getElementById('ai-part-display').textContent = `Part ${currentPart}`;
  document.getElementById('ai-preview').classList.add('hidden');
  document.getElementById('ai-loading').classList.add('hidden');
  document.getElementById('ai-generate-btn').classList.remove('hidden');
  document.getElementById('ai-import-btn').classList.add('hidden');
  generatedAIQuestions = [];
  selectedAIQuestions = new Set();
  openModal('modal-ai');
};

window.generateWithAI = async () => {
  const apiKey = localStorage.getItem('deepseek-api-key');
  if (!apiKey) {
    showToast('Please set your DeepSeek API key in Settings', 'error');
    closeModal('modal-ai');
    openModal('modal-settings');
    return;
  }

  const count = parseInt(document.getElementById('ai-count').value) || 5;
  const existingQuestions = currentQuestions.map(q => `- ${q.question}`).join('\n');
  const noExisting = existingQuestions ? existingQuestions : '(chưa có câu hỏi nào)';

  let prompt;
  if (currentPart === 2) {
    // Part 2: cue card format with "You should say"
    prompt = `Tạo cho tôi ${count} câu hỏi dạng Cue Card về chủ đề "${currentTopicName}" trong bài IELTS Speaking Part 2.
Mỗi câu hỏi phải theo đúng format chuẩn IELTS như ví dụ sau:

Describe a time when you helped someone.
You should say:
  - who you helped
  - what the situation was
  - how you helped them
and explain how you felt afterwards.

Chỉ liệt kê các câu hỏi, đánh số thứ tự. Không thêm giải thích. Không trùng với:\n${noExisting}`;
  } else if (currentPart === 1) {
    // Part 1: short conversational questions
    prompt = `Tạo cho tôi ${count} câu hỏi ngắn về chủ đề "${currentTopicName}" cho IELTS Speaking Part 1. Đây là các câu hỏi giao tiếp ngắn hỏi về kinh nghiệm, sở thích cá nhân (không phải dạng cue card). Chỉ liệt kê câu hỏi, đánh số thứ tự. Không trùng với:\n${noExisting}`;
  } else {
    // Part 3: discussion/abstract questions
    prompt = `Tạo cho tôi ${count} câu hỏi thảo luận học thuật về chủ đề "${currentTopicName}" cho IELTS Speaking Part 3. Đây là các câu hỏi mang tính phân tích, so sánh, dự đoán xu hướng xã hội. Chỉ liệt kê câu hỏi, đánh số thứ tự. Không trùng với:\n${noExisting}`;
  }

  document.getElementById('ai-loading').classList.remove('hidden');
  document.getElementById('ai-preview').classList.add('hidden');
  document.getElementById('ai-generate-btn').classList.add('hidden');

  try {
    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.8,
        max_tokens: 1000,
      }),
    });

    if (!res.ok) throw new Error(`API error: ${res.status}`);
    const data = await res.json();
    const text = data.choices[0].message.content;

    // Parse lines into questions - handle multi-line cue card format for Part 2
    if (currentPart === 2) {
      // For Part 2, group lines into cue card blocks (each block starts with "Describe/Talk/Explain...")
      const blocks = [];
      let current = [];
      for (const line of text.split('\n')) {
        const stripped = line.replace(/^\d+[\.\)]\s*/, '').trim();
        if (!stripped) continue;
        // New cue card starts when we see a numbered item or a "Describe/Talk/Explain" line
        if (/^\d+[\.\)]/.test(line) && current.length > 0) {
          blocks.push(current.join('\n'));
          current = [stripped];
        } else {
          current.push(stripped);
        }
      }
      if (current.length > 0) blocks.push(current.join('\n'));
      generatedAIQuestions = blocks.filter(b => b.length > 5);
    } else {
      generatedAIQuestions = text.split('\n')
        .map(line => line.replace(/^\d+[\.\)]\s*/, '').trim())
        .filter(line => line.length > 5);
    }

    document.getElementById('ai-loading').classList.add('hidden');
    renderAIQuestions();
    document.getElementById('ai-preview').classList.remove('hidden');
    document.getElementById('ai-import-btn').classList.remove('hidden');

  } catch (err) {
    console.error(err);
    document.getElementById('ai-loading').classList.add('hidden');
    document.getElementById('ai-generate-btn').classList.remove('hidden');
    showToast('AI generation failed: ' + err.message, 'error');
  }
};

function renderAIQuestions() {
  const list = document.getElementById('ai-questions-list');
  selectedAIQuestions = new Set(generatedAIQuestions.map((_, i) => i)); // all selected by default

  list.innerHTML = generatedAIQuestions.map((q, i) => `
    <div class="ai-question-item selected" id="ai-q-${i}" onclick="toggleAIQuestion(${i})">
      <div class="ai-question-check">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      </div>
      <div class="ai-question-text">${escapeHtml(q)}</div>
    </div>`).join('');
}

window.toggleAIQuestion = (idx) => {
  const el = document.getElementById(`ai-q-${idx}`);
  if (selectedAIQuestions.has(idx)) {
    selectedAIQuestions.delete(idx);
    el.classList.remove('selected');
  } else {
    selectedAIQuestions.add(idx);
    el.classList.add('selected');
  }
};

window.importAIQuestions = async () => {
  if (selectedAIQuestions.size === 0) {
    showToast('Select at least one question', 'error');
    return;
  }

  try {
    const qRef = collection(db, 'topics', currentTopicId, `part${currentPart}`);
    for (const idx of selectedAIQuestions) {
      await addDoc(qRef, {
        question: generatedAIQuestions[idx],
        answer: '',
        createdAt: Date.now(),
      });
    }
    await syncTopicStats();
    closeModal('modal-ai');
    showToast(`${selectedAIQuestions.size} questions imported!`, 'success');
    await loadQuestions();
  } catch (err) {
    showToast('Import failed', 'error');
  }
};

// ===== EXPORT TO PDF =====
window.exportAllQuestions = async () => {
  showToast('Preparing export...', 'info');

  try {
    // Fetch all topics
    const topicsRef = collection(db, 'topics');
    const topicsSnap = await getDocs(query(topicsRef, orderBy('createdAt')));
    const topics = topicsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Build HTML content
    let html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>IELTS Speaking — All Questions</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', sans-serif; color: #1e3a5f; background: #fff; padding: 32px; max-width: 800px; margin: 0 auto; }
    h1 { font-size: 26px; font-weight: 800; color: #1e3a5f; margin-bottom: 6px; }
    .subtitle { font-size: 14px; color: #8aabce; margin-bottom: 32px; }
    .topic-section { margin-bottom: 32px; break-inside: avoid; }
    .topic-title { font-size: 18px; font-weight: 700; color: #2563eb; border-left: 4px solid #3b82f6; padding-left: 12px; margin-bottom: 16px; }
    .part-label { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #8b5cf6; margin: 12px 0 8px; }
    .question-item { display: flex; gap: 12px; margin-bottom: 12px; border: 1px solid #e2eeff; border-radius: 8px; overflow: hidden; }
    .q-num { background: #3b82f6; color: white; font-size: 12px; font-weight: 700; width: 28px; min-width: 28px; display: flex; align-items: flex-start; justify-content: center; padding-top: 12px; }
    .q-body { padding: 10px 12px; flex: 1; }
    .q-text { font-size: 14px; font-weight: 500; line-height: 1.6; white-space: pre-wrap; }
    .q-answer { margin-top: 8px; padding-top: 8px; border-top: 1px solid #e2eeff; font-size: 13px; color: #4a6fa5; line-height: 1.7; white-space: pre-wrap; }
    .q-answer-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #22c55e; margin-bottom: 4px; }
    .question-item.answered { border-left: 3px solid #22c55e; }
    .question-item.answered .q-num { background: #16a34a; }
    .no-questions { font-size: 13px; color: #8aabce; font-style: italic; padding: 8px 0; }
    @media print { body { padding: 16px; } }
  </style>
</head>
<body>
  <h1>🎤 IELTS Speaking</h1>
  <p class="subtitle">Exported on ${new Date().toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
`;

    for (const topic of topics) {
      html += `<div class="topic-section"><div class="topic-title">${escapeHtml(topic.name)}</div>`;

      for (let p = 1; p <= 3; p++) {
        const qRef = collection(db, 'topics', topic.id, `part${p}`);
        const qSnap = await getDocs(query(qRef, orderBy('createdAt')));
        const questions = qSnap.docs.map(d => d.data());

        if (questions.length === 0) continue;

        html += `<div class="part-label">Part ${p}</div>`;
        questions.forEach((q, i) => {
          const hasAnswer = q.answer && q.answer.trim();
          html += `
            <div class="question-item ${hasAnswer ? 'answered' : ''}">
              <div class="q-num">${i + 1}</div>
              <div class="q-body">
                <div class="q-text">${escapeHtml(q.question)}</div>
                ${hasAnswer ? `<div class="q-answer"><div class="q-answer-label">Answer</div>${escapeHtml(q.answer)}</div>` : ''}
              </div>
            </div>`;
        });
      }
      html += `</div>`;
    }

    html += `</body></html>`;

    // Open in new window and print
    const win = window.open('', '_blank', 'width=900,height=700');
    win.document.write(html);
    win.document.close();
    win.onload = () => {
      setTimeout(() => win.print(), 300);
    };

    showToast('Export ready! Choose "Save as PDF" in print dialog.', 'success');
  } catch (err) {
    console.error(err);
    showToast('Export failed: ' + err.message, 'error');
  }
};

// ===== SETTINGS =====
window.openSettings = () => {
  const key = localStorage.getItem('deepseek-api-key') || '';
  document.getElementById('settings-deepseek-key').value = key;
  openModal('modal-settings');
};

window.saveSettings = () => {
  const key = document.getElementById('settings-deepseek-key').value.trim();
  localStorage.setItem('deepseek-api-key', key);
  closeModal('modal-settings');
  showToast('Settings saved!', 'success');
};

window.toggleKeyVisibility = (inputId) => {
  const input = document.getElementById(inputId);
  input.type = input.type === 'password' ? 'text' : 'password';
};

// ===== MODAL HELPERS =====
window.openModal = (id) => {
  document.getElementById(id).classList.add('open');
};
window.closeModal = (id) => {
  document.getElementById(id).classList.remove('open');
};

// Close modal on Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
  }
});

// ===== TOAST =====
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('fadeOut');
    setTimeout(() => toast.remove(), 300);
  }, 2800);
}

// ===== UTILS =====
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escapeAttr(str) {
  if (!str) return '';
  return encodeURIComponent(str);
}
