// ========================================
// GLOBALE VARIABLEN
// ========================================
let flashcards = JSON.parse(localStorage.getItem('flashcards')) || [];
let categories = JSON.parse(localStorage.getItem('categories')) || ['Mathe', 'Deutsch', 'Englisch'];
let currentIndex = 0;
let showAnswer = false;
let correctCount = 0;
let incorrectCount = 0;
let incorrectCards = [];
let currentWeightedCards = []; // Gewichtete Liste der aktuellen Lern-Session
let currentLearningLevel = null; // Welches Level wird gerade gelernt (für Stufen-basiertes Lernen)

// ========================================
// STORAGE FUNKTIONEN
// ========================================
function saveFlashcards() {
  localStorage.setItem('flashcards', JSON.stringify(flashcards));
}

function saveCategories() {
  localStorage.setItem('categories', JSON.stringify(categories));
}

// ========================================
// LEITNER SPACED REPETITION SYSTEM
// ========================================
// Wiederholungsintervalle in Tagen für jedes Level
const LEITNER_INTERVALS = {
  1: 1,    // Level 1: täglich
  2: 3,    // Level 2: alle 3 Tage
  3: 7,    // Level 3: wöchentlich
  4: 14,   // Level 4: alle 2 Wochen
  5: 30    // Level 5: monatlich
};

// Initialisiert Leitner-Daten für eine Karte
function initializeLeitnerData(card) {
  if (!card.level) card.level = 1;
  if (!card.lastReviewed) card.lastReviewed = null;
  if (!card.topic) card.topic = ''; // Thema-Feld für alte Karten
  // Setze nextReview auf gestern, damit die Karte sofort fällig ist
  if (!card.nextReview) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    card.nextReview = yesterday.toISOString();
  }
  return card;
}

// Berechnet das nächste Wiederholungsdatum
function calculateNextReview(level) {
  const now = new Date();
  const interval = LEITNER_INTERVALS[level] || 1;
  now.setDate(now.getDate() + interval);
  return now.toISOString();
}

// Aktualisiert die Karte nach einer richtigen Antwort
function handleCorrectAnswer(card) {
  card.level = Math.min(5, card.level + 1); // Max Level 5
  card.lastReviewed = new Date().toISOString();
  card.nextReview = calculateNextReview(card.level);
  return card;
}

// Aktualisiert die Karte nach einer falschen Antwort
function handleIncorrectAnswer(card) {
  card.level = 1; // Zurück auf Level 1
  card.lastReviewed = new Date().toISOString();
  card.nextReview = calculateNextReview(1);
  return card;
}

// Prüft ob eine Karte fällig ist
function isCardDue(card) {
  if (!card.nextReview) return true;
  return new Date(card.nextReview) <= new Date();
}

// Migriert bestehende Karten zum Leitner-System
function migrateLeitnerData() {
  let migrated = false;
  flashcards = flashcards.map(card => {
    if (!card.level) {
      migrated = true;
      return initializeLeitnerData(card);
    }
    return card;
  });
  if (migrated) {
    saveFlashcards();
    console.log('Karteikarten zum Leitner-System migriert');
  }
}

// ========================================
// STATISTIKEN & SESSION TRACKING
// ========================================
let sessions = JSON.parse(localStorage.getItem('sessions')) || [];

function saveSession(category, correct, incorrect) {
  const session = {
    date: new Date().toISOString(),
    category,
    correct,
    incorrect,
    total: correct + incorrect,
    successRate: correct + incorrect > 0 ? Math.round((correct / (correct + incorrect)) * 100) : 0
  };
  sessions.unshift(session); // Neueste zuerst
  sessions = sessions.slice(0, 10); // Nur die letzten 10 Sessions
  localStorage.setItem('sessions', JSON.stringify(sessions));
}

function getLeitnerStats() {
  const stats = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  flashcards.forEach(card => {
    const level = card.level || 1;
    stats[level]++;
  });
  return stats;
}

function getCategoryStats() {
  const categoryStats = {};
  categories.forEach(category => {
    const categoryCards = flashcards.filter(card => card.category === category);
    const total = categoryCards.length;
    const levelSum = categoryCards.reduce((sum, card) => sum + (card.level || 1), 0);
    const avgLevel = total > 0 ? levelSum / total : 0;
    const progress = total > 0 ? Math.round((avgLevel / 5) * 100) : 0;

    categoryStats[category] = {
      total,
      avgLevel: avgLevel.toFixed(1),
      progress
    };
  });
  return categoryStats;
}

function updateStatistics() {
  // Leitner-Box Übersicht
  const leitnerStats = getLeitnerStats();
  const totalCards = flashcards.length;
  let leitnerHTML = '';

  for (let level = 1; level <= 5; level++) {
    const count = leitnerStats[level];
    const percentage = totalCards > 0 ? (count / totalCards) * 100 : 0;
    leitnerHTML += `
      <div class="leitner-bar">
        <div class="leitner-label">Level ${level}</div>
        <div class="leitner-bar-container">
          <div class="leitner-bar-fill" style="width: ${percentage}%">
            ${percentage > 10 ? count : ''}
          </div>
        </div>
        <div class="leitner-count">${count}</div>
      </div>
    `;
  }
  document.getElementById('leitner-overview').innerHTML = leitnerHTML || '<p>Keine Karteikarten vorhanden</p>';

  // Lernverlauf
  let historyHTML = '';
  if (sessions.length > 0) {
    sessions.forEach(session => {
      const date = new Date(session.date);
      const dateStr = date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      historyHTML += `
        <div class="history-item">
          <div class="history-date">${dateStr} - ${session.category}</div>
          <div class="history-stats">
            ${session.total} Karten | ${session.correct} richtig | ${session.incorrect} falsch | Erfolgsquote: ${session.successRate}%
          </div>
        </div>
      `;
    });
  } else {
    historyHTML = '<p>Noch keine Lernsessions vorhanden</p>';
  }
  document.getElementById('learning-history').innerHTML = historyHTML;

  // Kategorie-Analyse
  const categoryStats = getCategoryStats();
  let categoryHTML = '';
  Object.entries(categoryStats).forEach(([category, stats]) => {
    categoryHTML += `
      <div class="category-item">
        <div class="category-name">${category} (${stats.total} Karten)</div>
        <div class="category-progress">
          <div class="progress-bar-container">
            <div class="progress-bar-fill" style="width: ${stats.progress}%"></div>
          </div>
          <div class="progress-text">${stats.progress}%</div>
        </div>
        <div style="font-size: 12px; color: #666; margin-top: 3px;">Durchschnittliches Level: ${stats.avgLevel}</div>
      </div>
    `;
  });
  document.getElementById('category-analysis').innerHTML = categoryHTML || '<p>Keine Kategorien vorhanden</p>';
}

// ========================================
// EXPORT/IMPORT FUNKTIONEN
// ========================================
function exportData() {
  const exportData = {
    version: '1.0',
    exportDate: new Date().toISOString(),
    flashcards: flashcards,
    categories: categories,
    sessions: sessions
  };

  const dataStr = JSON.stringify(exportData, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);

  const link = document.createElement('a');
  link.href = url;
  const filename = `karteikarten_backup_${new Date().toISOString().split('T')[0]}.json`;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);
  alert('Daten erfolgreich exportiert!');
}

function importData(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const importedData = JSON.parse(e.target.result);

      // Validierung
      if (!importedData.version || !importedData.flashcards || !importedData.categories) {
        alert('Ungültiges Dateiformat!');
        return;
      }

      // Merge-Option anbieten
      const mergeChoice = confirm(
        'Möchten Sie die importierten Daten mit den bestehenden Daten zusammenführen?\n\n' +
        'OK = Zusammenführen (bestehende Daten bleiben erhalten)\n' +
        'Abbrechen = Ersetzen (alle bestehenden Daten werden gelöscht)'
      );

      if (mergeChoice) {
        // Merge: Füge nur neue Karten hinzu
        const existingQuestions = new Set(flashcards.map(card => card.question));
        const newCards = importedData.flashcards.filter(card => !existingQuestions.has(card.question));
        flashcards.push(...newCards);

        // Merge Kategorien
        const newCategories = importedData.categories.filter(cat => !categories.includes(cat));
        categories.push(...newCategories);

        // Merge Sessions
        if (importedData.sessions) {
          sessions.push(...importedData.sessions);
          sessions = sessions.slice(0, 20); // Behalte max 20 Sessions
        }

        alert(`Import erfolgreich!\n${newCards.length} neue Karteikarten hinzugefügt.`);
      } else {
        // Replace: Ersetze alle Daten
        flashcards = importedData.flashcards;
        categories = importedData.categories;
        sessions = importedData.sessions || [];

        alert('Daten erfolgreich importiert und ersetzt!');
      }

      // Wichtig: Migriere importierte Karten zum Leitner-System
      migrateLeitnerData();

      // Speichern und UI aktualisieren
      saveFlashcards();
      saveCategories();
      localStorage.setItem('sessions', JSON.stringify(sessions));
      loadCategories();
      loadFlashcards();
      loadFlashcardsForEdit();

    } catch (error) {
      alert('Fehler beim Importieren der Daten: ' + error.message);
    }
  };

  reader.readAsText(file);
  // Reset file input
  event.target.value = '';
}

// ========================================
// SEITEN-NAVIGATION
// ========================================
function showPage(pageId) {
  document.querySelectorAll('.page').forEach(page => {
    page.classList.remove('active');
  });
  document.getElementById(pageId).classList.add('active');

  if (pageId === 'flashcard-page') {
    // WICHTIG: Nur Karten neu laden wenn wir NICHT gerade stufenbasiertes Lernen machen
    // Wenn currentLearningLevel gesetzt ist, wurden die Karten bereits in startLevelLearning() geladen
    if (currentLearningLevel === null) {
      // Normales gewichtetes Lernen: Lade alle Karten der Kategorie
      const selectedCategory = document.getElementById('category').value;
      const categoryCards = flashcards.filter(card => card.category === selectedCategory);
      currentWeightedCards = createWeightedFlashcards(categoryCards);
      currentIndex = 0;
      resetFlashcardDisplay();
      updateFlashcardDisplay(currentWeightedCards);
    }
    // Bei stufenbasiertem Lernen: Karten wurden bereits in startLevelLearning() gesetzt, nichts tun
  } else if (pageId === 'statistics-page') {
    updateStatistics();
  } else if (pageId === 'level-overview-page') {
    // Lösche alte Session-Daten, um sicherzustellen dass keine stale data angezeigt wird
    currentWeightedCards = [];
    currentIndex = 0;
    showLevelOverview();
  } else if (pageId === 'remove-flashcard-page') {
    loadFlashcardsForDelete();
  }
}

function resetFlashcardDisplay() {
  showAnswer = false;
  const flashcard = document.querySelector('.flashcard');
  if (flashcard) {
    flashcard.classList.remove('flipped');
  }
  document.getElementById('toggle-answer').innerText = 'Antwort anzeigen';
  document.getElementById('correct-answer').style.display = 'none';
  document.getElementById('incorrect-answer').style.display = 'none';
}

// ========================================
// KATEGORIEN-VERWALTUNG
// ========================================
function addCategory() {
  const newCategory = document.getElementById('new-category-name').value;
  if (newCategory && !categories.includes(newCategory)) {
    categories.push(newCategory);
    saveCategories();
    loadCategories();
    document.getElementById('new-category-name').value = '';
    showPage('settings-page');
  }
}

function removeCategory() {
  const categoryToRemove = document.getElementById('remove-category').value;
  categories = categories.filter(category => category !== categoryToRemove);
  saveCategories();
  loadCategories();
  showPage('settings-page');
}

function loadCategories() {
  const categorySelect = document.getElementById('category');
  const newCategorySelect = document.getElementById('new-category');
  const removeCategorySelect = document.getElementById('remove-category');
  categorySelect.innerHTML = '';
  newCategorySelect.innerHTML = '';
  removeCategorySelect.innerHTML = '';
  categories.forEach(category => {
    const option = document.createElement('option');
    option.value = category;
    option.textContent = category;
    categorySelect.appendChild(option);
    newCategorySelect.appendChild(option.cloneNode(true));
    removeCategorySelect.appendChild(option.cloneNode(true));
  });
}

// ========================================
// KARTEIKARTEN-VERWALTUNG
// ========================================
function addFlashcard() {
  const question = document.getElementById('new-question').value;
  const answer = document.getElementById('new-answer').value;
  const category = document.getElementById('new-category').value;
  const topic = document.getElementById('new-topic').value || ''; // Optional

  if (question && answer && category) {
    const newCard = initializeLeitnerData({ question, answer, category, topic });
    flashcards.push(newCard);
    saveFlashcards();
    document.getElementById('new-question').value = '';
    document.getElementById('new-answer').value = '';
    document.getElementById('new-topic').value = '';
    loadFlashcards();
    showPage('settings-page');
  }
}

function removeFlashcard() {
  const flashcardToRemove = document.getElementById('remove-flashcard').value;
  flashcards = flashcards.filter(card => card.question !== flashcardToRemove);
  saveFlashcards();
  loadFlashcards();
  showPage('settings-page');
}

function loadFlashcards() {
  loadFlashcardsForDelete();
}

// Lädt Karteikarten in die neue Checkbox-Liste für Mehrfach-Löschung
function loadFlashcardsForDelete() {
  const deleteList = document.getElementById('flashcard-delete-list');
  if (!deleteList) return;

  deleteList.innerHTML = '';

  if (flashcards.length === 0) {
    deleteList.innerHTML = '<p class="no-cards-message">Keine Karteikarten vorhanden.</p>';
    return;
  }

  flashcards.forEach((card, index) => {
    const cardDiv = document.createElement('div');
    cardDiv.className = 'delete-card-item';
    cardDiv.innerHTML = `
      <div class="delete-card-checkbox">
        <input type="checkbox" id="card-${index}" value="${index}" onchange="updateSelectedCount()">
      </div>
      <label for="card-${index}" class="delete-card-content">
        <div class="delete-card-header">
          <span class="delete-card-category">${card.category}</span>
          ${card.level ? `<span class="delete-card-level">Stufe ${card.level}</span>` : ''}
        </div>
        ${card.topic ? `<div class="delete-card-topic"><i class="fas fa-tag"></i> ${card.topic}</div>` : ''}
        <div class="delete-card-question"><strong>Frage:</strong> ${card.question}</div>
        <div class="delete-card-answer"><strong>Antwort:</strong> ${card.answer}</div>
      </label>
    `;
    deleteList.appendChild(cardDiv);
  });

  updateSelectedCount();
}

// Aktualisiert die Anzahl ausgewählter Karten
function updateSelectedCount() {
  const checkboxes = document.querySelectorAll('#flashcard-delete-list input[type="checkbox"]');
  const selectedCount = Array.from(checkboxes).filter(cb => cb.checked).length;
  const countDisplay = document.getElementById('selected-count');
  if (countDisplay) {
    countDisplay.textContent = `${selectedCount} ausgewählt`;
  }
}

// Wählt alle Karten aus
function selectAllCards() {
  const checkboxes = document.querySelectorAll('#flashcard-delete-list input[type="checkbox"]');
  checkboxes.forEach(cb => cb.checked = true);
  updateSelectedCount();
}

// Wählt alle Karten ab
function deselectAllCards() {
  const checkboxes = document.querySelectorAll('#flashcard-delete-list input[type="checkbox"]');
  checkboxes.forEach(cb => cb.checked = false);
  updateSelectedCount();
}

// Löscht mehrere ausgewählte Karteikarten
function removeMultipleFlashcards() {
  const checkboxes = document.querySelectorAll('#flashcard-delete-list input[type="checkbox"]:checked');
  const selectedIndices = Array.from(checkboxes).map(cb => parseInt(cb.value));

  if (selectedIndices.length === 0) {
    alert('Bitte wähle mindestens eine Karteikarte zum Löschen aus.');
    return;
  }

  const confirmMessage = `Möchtest du wirklich ${selectedIndices.length} Karteikarte${selectedIndices.length !== 1 ? 'n' : ''} löschen?`;
  if (!confirm(confirmMessage)) {
    return;
  }

  // Sortiere Indizes absteigend, um beim Löschen keine Indexverschiebung zu bekommen
  selectedIndices.sort((a, b) => b - a);

  // Lösche die Karten
  selectedIndices.forEach(index => {
    flashcards.splice(index, 1);
  });

  saveFlashcards();
  loadFlashcards();
  loadFlashcardsForEdit();

  alert(`${selectedIndices.length} Karteikarte${selectedIndices.length !== 1 ? 'n' : ''} erfolgreich gelöscht!`);
}

// ========================================
// STUFEN-ÜBERSICHT (LEVEL OVERVIEW)
// ========================================
function showLevelOverview() {
  // Wichtig: Lade flashcards neu aus localStorage, um aktuelle Level-Änderungen zu sehen
  flashcards = JSON.parse(localStorage.getItem('flashcards')) || [];

  const selectedCategory = document.getElementById('category').value;
  document.getElementById('level-selected-category').textContent = selectedCategory;

  // Hole alle Karten der ausgewählten Kategorie
  const categoryCards = flashcards.filter(card => card.category === selectedCategory);

  // Zähle Karten pro Level
  const levelCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  categoryCards.forEach(card => {
    const level = card.level || 1;
    levelCounts[level]++;
  });

  // Erstelle HTML für Level-Übersicht
  let html = '';

  // Button für gemischtes Lernen (alle Stufen mit Gewichtung)
  if (categoryCards.length > 0) {
    html += `
      <div class="mixed-learning-section">
        <button onclick="startMixedLearning()" class="btn-mixed-learning">
          <i class="fas fa-random"></i> Alle Stufen gemischt lernen
        </button>
        <p class="mixed-learning-info">Level 1 Karten erscheinen häufiger (Weighted System)</p>
      </div>
    `;
  }

  for (let level = 1; level <= 5; level++) {
    const count = levelCounts[level];
    const percentage = categoryCards.length > 0 ? (count / categoryCards.length) * 100 : 0;
    const intervalText = level === 1 ? 'täglich' :
                        level === 2 ? 'alle 3 Tage' :
                        level === 3 ? 'wöchentlich' :
                        level === 4 ? 'alle 2 Wochen' : 'monatlich';

    html += `
      <div class="level-item">
        <div class="level-header">
          <h3>Stufe ${level}</h3>
          <span class="level-interval">${intervalText}</span>
        </div>
        <div class="level-bar-container">
          <div class="level-bar-fill level-${level}" style="width: ${percentage}%">
            ${percentage > 10 ? count : ''}
          </div>
        </div>
        <div class="level-info">
          <span class="level-count">${count} Karte${count !== 1 ? 'n' : ''}</span>
          ${count > 0 ? `<button onclick="startLevelLearning(${level})" class="btn-level-start"><i class="fas fa-play"></i> Lernen</button>` : ''}
        </div>
      </div>
    `;
  }

  if (categoryCards.length === 0) {
    html = '<p class="no-cards-message">Keine Karteikarten in dieser Kategorie vorhanden.</p>';
  }

  document.getElementById('level-overview-container').innerHTML = html;
}

// Startet das Lernen für eine bestimmte Stufe
function startLevelLearning(level) {
  const selectedCategory = document.getElementById('category').value;
  const levelCards = filterByLevelAndCategory(selectedCategory, level);

  if (levelCards.length === 0) {
    alert('Keine Karten in dieser Stufe vorhanden!');
    return;
  }

  // Setze die aktuellen Karten (OHNE Gewichtung, nur die gewählte Stufe)
  currentWeightedCards = levelCards.sort(() => Math.random() - 0.5); // Nur mischen
  currentIndex = 0;
  correctCount = 0;
  incorrectCount = 0;
  incorrectCards = [];
  currentLearningLevel = level; // Speichere welches Level gelernt wird

  resetFlashcardDisplay();
  updateFlashcardDisplay(currentWeightedCards);

  // Stelle sicher, dass die Buttons beim Start aktiviert sind
  setTimeout(() => {
    const correctBtn = document.getElementById('correct-answer');
    const incorrectBtn = document.getElementById('incorrect-answer');
    if (correctBtn) correctBtn.disabled = false;
    if (incorrectBtn) incorrectBtn.disabled = false;
  }, 100);

  showPage('flashcard-page');
}

// Filtert Karten nach Kategorie und Stufe
function filterByLevelAndCategory(category, level) {
  return flashcards.filter(card =>
    card.category === category && (card.level || 1) === level
  );
}

// Startet das gemischte Lernen (alle Stufen mit Gewichtung)
function startMixedLearning() {
  const selectedCategory = document.getElementById('category').value;
  const categoryCards = flashcards.filter(card => card.category === selectedCategory);

  if (categoryCards.length === 0) {
    alert('Keine Karten in dieser Kategorie vorhanden!');
    return;
  }

  // Erstelle gewichtete Liste (Level 1 = 5x, Level 2 = 4x, etc.)
  currentWeightedCards = createWeightedFlashcards(categoryCards);
  currentIndex = 0;
  correctCount = 0;
  incorrectCount = 0;
  incorrectCards = [];
  currentLearningLevel = null; // WICHTIG: null = gemischtes Lernen (nicht stufenbasiert)

  resetFlashcardDisplay();
  updateFlashcardDisplay(currentWeightedCards);

  // Stelle sicher, dass die Buttons beim Start aktiviert sind
  setTimeout(() => {
    const correctBtn = document.getElementById('correct-answer');
    const incorrectBtn = document.getElementById('incorrect-answer');
    if (correctBtn) correctBtn.disabled = false;
    if (incorrectBtn) incorrectBtn.disabled = false;
  }, 100);

  showPage('flashcard-page');
}

// ========================================
// LERN-LOGIK
// ========================================

// Gewichtete Karten-Liste erstellen basierend auf Level
function createWeightedFlashcards(cards) {
  const weighted = [];
  cards.forEach(card => {
    // Gewichtung: Level 1 = 5x, Level 2 = 4x, ..., Level 5 = 1x
    const weight = 6 - (card.level || 1);
    for (let i = 0; i < weight; i++) {
      weighted.push(card);
    }
  });
  // Mische die gewichtete Liste
  return weighted.sort(() => Math.random() - 0.5);
}

function filterFlashcards() {
  const selectedCategory = document.getElementById('category').value;
  // Zeige ALLE Karten der ausgewählten Kategorie, aber gewichtet
  const categoryCards = flashcards.filter(card =>
    card.category === selectedCategory
  );

  // Erstelle gewichtete Liste und speichere sie global
  currentWeightedCards = createWeightedFlashcards(categoryCards);

  currentIndex = 0;
  resetFlashcardDisplay();
  updateFlashcardDisplay(currentWeightedCards);
}

function updateFlashcardDisplay(filteredFlashcards = flashcards) {
  if (filteredFlashcards.length > 0) {
    const currentCard = filteredFlashcards[currentIndex];

    // Zeige Thema auf Vorder- und Rückseite (falls vorhanden)
    const topicFront = document.getElementById('topic-front');
    const topicBack = document.getElementById('topic-back');
    if (currentCard.topic) {
      topicFront.textContent = `Thema: ${currentCard.topic}`;
      topicBack.textContent = `Thema: ${currentCard.topic}`;
      topicFront.style.display = 'block';
      topicBack.style.display = 'block';
    } else {
      topicFront.style.display = 'none';
      topicBack.style.display = 'none';
    }

    document.getElementById('question').innerText = currentCard.question;
    document.getElementById('answer').innerText = '';
    document.getElementById('toggle-answer').innerText = 'Antwort anzeigen';
    document.getElementById('correct-answer').style.display = 'none';
    document.getElementById('incorrect-answer').style.display = 'none';
  } else {
    document.getElementById('topic-front').style.display = 'none';
    document.getElementById('topic-back').style.display = 'none';
    document.getElementById('question').innerText = 'Keine Karteikarten vorhanden';
    document.getElementById('answer').innerText = '';
    document.getElementById('toggle-answer').innerText = 'Antwort anzeigen';
  }
}


// ========================================
// EVENT LISTENER
// ========================================
document.getElementById('toggle-answer').addEventListener('click', () => {
  if (flashcards.length > 0 && currentWeightedCards.length > 0) {
    showAnswer = !showAnswer;
    const flashcard = document.querySelector('.flashcard');
    const currentCard = currentWeightedCards[currentIndex];

    if (showAnswer && currentCard) {
      // Flip zur Antwort
      const answerText = currentCard.answer || 'Keine Antwort vorhanden';
      document.getElementById('answer').innerText = answerText;
      flashcard.classList.add('flipped');
      document.getElementById('toggle-answer').innerText = 'Frage anzeigen';
      document.getElementById('correct-answer').style.display = 'inline-block';
      document.getElementById('incorrect-answer').style.display = 'inline-block';
    } else {
      // Flip zurück zur Frage
      flashcard.classList.remove('flipped');
      document.getElementById('toggle-answer').innerText = 'Antwort anzeigen';
      document.getElementById('correct-answer').style.display = 'none';
      document.getElementById('incorrect-answer').style.display = 'none';
    }
  }
});

document.getElementById('correct-answer').addEventListener('click', () => {
  // WICHTIG: Buttons sofort deaktivieren um Race Conditions zu vermeiden
  const correctBtn = document.getElementById('correct-answer');
  const incorrectBtn = document.getElementById('incorrect-answer');
  correctBtn.disabled = true;
  incorrectBtn.disabled = true;

  correctCount++;

  // Erfasse die Karte SOFORT, bevor irgendwas anderes passiert
  const currentCard = currentWeightedCards[currentIndex];

  // Aktualisiere Leitner-Daten für richtige Antwort
  const originalIndex = flashcards.findIndex(card =>
    card.question === currentCard.question &&
    card.category === currentCard.category &&
    card.answer === currentCard.answer // Verbesserte Matching-Genauigkeit
  );
  if (originalIndex !== -1) {
    flashcards[originalIndex] = handleCorrectAnswer(flashcards[originalIndex]);
    saveFlashcards();
  }

  document.getElementById('flashcard-container').classList.add('correct');
  setTimeout(() => {
    document.getElementById('flashcard-container').classList.remove('correct');
    nextCard();
  }, 1000);
});

document.getElementById('incorrect-answer').addEventListener('click', () => {
  // WICHTIG: Buttons sofort deaktivieren um Race Conditions zu vermeiden
  const correctBtn = document.getElementById('correct-answer');
  const incorrectBtn = document.getElementById('incorrect-answer');
  correctBtn.disabled = true;
  incorrectBtn.disabled = true;

  incorrectCount++;

  // Erfasse die Karte SOFORT, bevor irgendwas anderes passiert
  const currentCard = currentWeightedCards[currentIndex];
  incorrectCards.push(currentCard);

  // Aktualisiere Leitner-Daten für falsche Antwort
  const originalIndex = flashcards.findIndex(card =>
    card.question === currentCard.question &&
    card.category === currentCard.category &&
    card.answer === currentCard.answer // Verbesserte Matching-Genauigkeit
  );
  if (originalIndex !== -1) {
    flashcards[originalIndex] = handleIncorrectAnswer(flashcards[originalIndex]);
    saveFlashcards();
  }

  document.getElementById('flashcard-container').classList.add('incorrect');
  setTimeout(() => {
    document.getElementById('flashcard-container').classList.remove('incorrect');
    nextCard();
  }, 1000);
});

function nextCard() {
  currentIndex = (currentIndex + 1) % currentWeightedCards.length;
  if (currentIndex === 0) {
    showResult();
  } else {
    resetFlashcardDisplay();
    updateFlashcardDisplay(currentWeightedCards);

    // Buttons wieder aktivieren für die nächste Karte (aber erst nach dem Flip)
    // Die Buttons werden in resetFlashcardDisplay ausgeblendet, also warten wir kurz
    setTimeout(() => {
      const correctBtn = document.getElementById('correct-answer');
      const incorrectBtn = document.getElementById('incorrect-answer');
      if (correctBtn) correctBtn.disabled = false;
      if (incorrectBtn) incorrectBtn.disabled = false;
    }, 100);
  }
}

function showResult() {
  let resultText = `Du hast ${correctCount} richtig und ${incorrectCount} falsch beantwortet.`;

  // Wenn wir stufenbasiertes Lernen nutzen, prüfe ob die Stufe jetzt leer ist
  if (currentLearningLevel !== null) {
    const selectedCategory = document.getElementById('category').value;
    const remainingCards = filterByLevelAndCategory(selectedCategory, currentLearningLevel);

    if (remainingCards.length === 0) {
      // Alle Karten haben die Stufe gewechselt!
      if (correctCount > 0 && incorrectCount === 0) {
        resultText += `\n\n🎉 Glückwunsch! Alle Karten sind in die nächste Stufe aufgestiegen!\nStufe ${currentLearningLevel} ist jetzt leer.`;
      } else if (incorrectCount > 0 && correctCount === 0) {
        resultText += `\n\n📚 Alle Karten sind zurück in Stufe 1.\nStufe ${currentLearningLevel} ist jetzt leer.`;
      } else {
        resultText += `\n\n✅ Alle Karten dieser Stufe wurden beantwortet!\nStufe ${currentLearningLevel} ist jetzt leer.`;
      }
    } else {
      resultText += `\n\nNoch ${remainingCards.length} Karte${remainingCards.length !== 1 ? 'n' : ''} in Stufe ${currentLearningLevel}.`;
    }
  }

  document.getElementById('result').innerText = resultText;

  // Speichere Session
  const selectedCategory = document.getElementById('category').value;
  if (correctCount + incorrectCount > 0) {
    saveSession(selectedCategory, correctCount, incorrectCount);
  }

  showPage('result-page');
}

function showIncorrectCards() {
  const incorrectCardsList = document.getElementById('incorrect-cards-list');
  incorrectCardsList.innerHTML = '';
  incorrectCards.forEach(card => {
    const cardElement = document.createElement('div');
    cardElement.innerText = `${card.category}: ${card.question} - ${card.answer}`;
    incorrectCardsList.appendChild(cardElement);
  });
  showPage('incorrect-cards-page');
}

function loadFlashcardsForEdit() {
  const editFlashcardSelect = document.getElementById('edit-flashcard-select');
  editFlashcardSelect.innerHTML = '';
  flashcards.forEach((card, index) => {
    const option = document.createElement('option');
    option.value = index;
    const displayTopic = card.topic ? `[${card.topic}] ` : '';
    option.textContent = `${card.category}: ${displayTopic}${card.question.substring(0, 40)}...`;
    editFlashcardSelect.appendChild(option);
  });

  // Lade die erste Karte beim Initialisieren
  if (flashcards.length > 0) {
    loadFlashcardForEdit();
  }
}

function loadFlashcardForEdit() {
  const selectedIndex = document.getElementById('edit-flashcard-select').value;
  if (selectedIndex !== '' && flashcards[selectedIndex]) {
    const card = flashcards[selectedIndex];
    document.getElementById('edit-topic').value = card.topic || '';
    document.getElementById('edit-question').value = card.question || '';
    document.getElementById('edit-answer').value = card.answer || '';
  }
}

function editFlashcard() {
  const selectedIndex = document.getElementById('edit-flashcard-select').value;
  const newTopic = document.getElementById('edit-topic').value || '';
  const newQuestion = document.getElementById('edit-question').value;
  const newAnswer = document.getElementById('edit-answer').value;

  if (selectedIndex !== '' && newQuestion && newAnswer) {
    flashcards[selectedIndex].topic = newTopic;
    flashcards[selectedIndex].question = newQuestion;
    flashcards[selectedIndex].answer = newAnswer;
    saveFlashcards();
    loadFlashcards();
    loadFlashcardsForEdit();
    showPage('settings-page');
  }
}

// ========================================
// INITIALISIERUNG
// ========================================
document.addEventListener('DOMContentLoaded', () => {
  migrateLeitnerData(); // Migriere bestehende Karten
  loadCategories();
  loadFlashcards();
  loadFlashcardsForEdit();
  updateFlashcardDisplay();
  showPage('start-page');
});


document.getElementById('result-page').addEventListener('click', () => {
  correctCount = 0;
  incorrectCount = 0;
  incorrectCards = [];
  currentLearningLevel = null; // Reset level tracking
});

// Service Worker Registration für PWA
// Touchpad-/Mausrad-Scrolling für Frage auf Desktop sicherstellen
document.getElementById('question').addEventListener('wheel', function(e) {
  const el = this;
  const atTop = el.scrollTop === 0;
  const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
  if (!(atTop && e.deltaY < 0) && !(atBottom && e.deltaY > 0)) {
    e.stopPropagation();
  }
}, { passive: true });

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').then(registration => {
      console.log('ServiceWorker registration successful with scope: ', registration.scope);
    }, err => {
      console.log('ServiceWorker registration failed: ', err);
    });
  });
}
