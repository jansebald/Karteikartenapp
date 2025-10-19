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
  if (!card.nextReview) card.nextReview = new Date().toISOString();
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
    resetFlashcardDisplay();
    filterFlashcards();
  } else if (pageId === 'statistics-page') {
    updateStatistics();
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

  if (question && answer && category) {
    const newCard = initializeLeitnerData({ question, answer, category });
    flashcards.push(newCard);
    saveFlashcards();
    document.getElementById('new-question').value = '';
    document.getElementById('new-answer').value = '';
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
  const removeFlashcardSelect = document.getElementById('remove-flashcard');
  removeFlashcardSelect.innerHTML = '';
  flashcards.forEach(card => {
    const option = document.createElement('option');
    option.value = card.question;
    option.textContent = `${card.category}: ${card.question}`;
    removeFlashcardSelect.appendChild(option);
  });
}

// ========================================
// LERN-LOGIK
// ========================================
function filterFlashcards() {
  const selectedCategory = document.getElementById('category').value;
  // Nur fällige Karten der ausgewählten Kategorie
  const filteredFlashcards = flashcards.filter(card =>
    card.category === selectedCategory && isCardDue(card)
  );
  currentIndex = 0;
  resetFlashcardDisplay();
  updateFlashcardDisplay(filteredFlashcards);
}

function updateFlashcardDisplay(filteredFlashcards = flashcards) {
  if (filteredFlashcards.length > 0) {
    document.getElementById('question').innerText = filteredFlashcards[currentIndex].question;
    document.getElementById('answer').innerText = ''; // Antwort zurücksetzen
    document.getElementById('answer').style.display = 'none';
    document.getElementById('toggle-answer').innerText = 'Antwort anzeigen';
    document.getElementById('correct-answer').style.display = 'none';
    document.getElementById('incorrect-answer').style.display = 'none';
  } else {
    document.getElementById('question').innerText = 'Keine Karteikarten vorhanden';
    document.getElementById('answer').innerText = ''; // Antwort zurücksetzen
    document.getElementById('answer').style.display = 'none';
    document.getElementById('toggle-answer').innerText = 'Antwort anzeigen';
  }
}


// ========================================
// EVENT LISTENER
// ========================================
document.getElementById('toggle-answer').addEventListener('click', () => {
  if (flashcards.length > 0) {
    showAnswer = !showAnswer;
    const flashcard = document.querySelector('.flashcard');
    const selectedCategory = document.getElementById('category').value;
    const filteredFlashcards = flashcards.filter(card => card.category === selectedCategory);

    if (showAnswer) {
      // Flip zur Antwort
      document.getElementById('answer').innerText = filteredFlashcards[currentIndex].answer;
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
  correctCount++;
  const selectedCategory = document.getElementById('category').value;
  const filteredFlashcards = flashcards.filter(card =>
    card.category === selectedCategory && isCardDue(card)
  );

  // Aktualisiere Leitner-Daten für richtige Antwort
  const currentCard = filteredFlashcards[currentIndex];
  const originalIndex = flashcards.findIndex(card => card === currentCard);
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
  incorrectCount++;
  const selectedCategory = document.getElementById('category').value;
  const filteredFlashcards = flashcards.filter(card =>
    card.category === selectedCategory && isCardDue(card)
  );

  const currentCard = filteredFlashcards[currentIndex];
  incorrectCards.push(currentCard);

  // Aktualisiere Leitner-Daten für falsche Antwort
  const originalIndex = flashcards.findIndex(card => card === currentCard);
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
  const selectedCategory = document.getElementById('category').value;
  // Nur fällige Karten berücksichtigen
  const filteredFlashcards = flashcards.filter(card =>
    card.category === selectedCategory && isCardDue(card)
  );
  currentIndex = (currentIndex + 1) % filteredFlashcards.length;
  if (currentIndex === 0) {
    showResult();
  } else {
    resetFlashcardDisplay();
    updateFlashcardDisplay(filteredFlashcards);
  }
}

function showResult() {
  const resultText = `Du hast ${correctCount} richtig und ${incorrectCount} falsch beantwortet.`;
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
    option.textContent = `${card.category}: ${card.question}`;
    editFlashcardSelect.appendChild(option);
  });
}

function editFlashcard() {
  const selectedIndex = document.getElementById('edit-flashcard-select').value;
  const newQuestion = document.getElementById('edit-question').value;
  const newAnswer = document.getElementById('edit-answer').value;

  if (selectedIndex !== '' && newQuestion && newAnswer) {
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
});

// Service Worker Registration für PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').then(registration => {
      console.log('ServiceWorker registration successful with scope: ', registration.scope);
    }, err => {
      console.log('ServiceWorker registration failed: ', err);
    });
  });
}
