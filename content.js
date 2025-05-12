(function() {
  let annotations = [];
  let removedAnnotations = [];
  let highlightMode = false;
  let eraseMode = false;
  let noteMode = false;
  let highlightColor = null;
  let activeBtn = null;

  // --- Utility Functions ---
  function saveAnnotations() {
    chrome.storage.local.set({ annotations });
  }

  function loadAnnotations(callback) {
    chrome.storage.local.get('annotations', (result) => {
      annotations = Array.isArray(result.annotations) ? result.annotations : [];
      if (callback) callback(annotations);
    });
  }

  function unwrapSpan(span) {
    const parent = span.parentNode;
    while (span.firstChild) parent.insertBefore(span.firstChild, span);
    parent.removeChild(span);
  }

  // --- Highlight Logic ---
  function enableHighlightMode(color, btn) {
    clearModes();
    highlightMode = true;
    highlightColor = color;
    document.body.style.cursor = 'text';
    setActiveBtn(btn);
    document.addEventListener('mouseup', highlightHandler);
    document.addEventListener('keydown', escHandler);
  }

  function highlightHandler() {
    if (!highlightMode || !highlightColor) return;
    const selection = window.getSelection();
    if (!selection.isCollapsed && selection.rangeCount > 0) {
      const text = selection.toString();
      const range = selection.getRangeAt(0);
      if (range.startContainer.parentNode.classList && range.startContainer.parentNode.classList.contains('annotated-text')) {
        selection.removeAllRanges();
        return;
      }
      const span = document.createElement('span');
      span.className = 'annotated-text';
      span.style.backgroundColor = highlightColor;
      span.textContent = text;
      span.setAttribute('data-ann-id', Date.now() + '-' + Math.floor(Math.random() * 100000));
      range.deleteContents();
      range.insertNode(span);

      annotations.push({
        id: span.getAttribute('data-ann-id'),
        text,
        color: highlightColor,
        note: '',
        pageUrl: window.location.href,
        date: new Date().toISOString()
      });
      saveAnnotations();
      selection.removeAllRanges();
    }
  }

  // --- Erase Logic ---
  function enableEraseMode(btn) {
    clearModes();
    eraseMode = true;
    document.body.style.cursor = 'pointer';
    setActiveBtn(btn);
    document.addEventListener('mousedown', eraseHandler);
    document.addEventListener('keydown', escHandler);
  }

  function eraseHandler(event) {
    if (!eraseMode) return;
    const span = event.target.closest('.annotated-text');
    if (span) {
      const annId = span.getAttribute('data-ann-id');
      const idx = annotations.findIndex(a => a.id === annId);
      if (idx !== -1) {
        removedAnnotations.push(annotations[idx]);
        annotations.splice(idx, 1);
        saveAnnotations();
      }
      unwrapSpan(span);
    }
  }

  // --- Undo Logic ---
  function undoErase(btn) {
    if (removedAnnotations.length > 0) {
      const annotation = removedAnnotations.pop();
      annotations.push(annotation);
      saveAnnotations();
      applyAnnotations();
    }
    setActiveBtn(btn);
  }

  // --- Note Mode Logic ---
  function enableNoteMode(btn) {
    clearModes();
    noteMode = true;
    document.body.style.cursor = 'help';
    setActiveBtn(btn);
    document.addEventListener('click', noteHandler, true);
    document.addEventListener('keydown', escHandler);
  }

  function noteHandler(event) {
    if (!noteMode) return;
    const span = event.target.closest('.annotated-text');
    if (span) {
      event.stopPropagation();
      event.preventDefault();
      showNoteEditor(span);
    }
  }

  function showNoteEditor(span) {
    const existing = document.getElementById('note-editor');
    if (existing) existing.remove();

    const annId = span.getAttribute('data-ann-id');
    const annotation = annotations.find(a => a.id === annId);

    const editor = document.createElement('div');
    editor.id = 'note-editor';
    editor.style.position = 'absolute';
    editor.style.background = 'white';
    editor.style.border = '1.5px solid #ccc';
    editor.style.padding = '12px';
    editor.style.boxShadow = '0 2px 10px rgba(0,0,0,0.15)';
    editor.style.zIndex = '100000';
    editor.style.borderRadius = '8px';

    const textarea = document.createElement('textarea');
    textarea.style.width = '320px';
    textarea.style.height = '80px';
    textarea.style.marginBottom = '10px';
    textarea.style.padding = '8px';
    textarea.style.border = '1px solid #ddd';
    textarea.style.borderRadius = '4px';
    textarea.placeholder = 'Add your note here...';
    textarea.value = annotation && annotation.note ? annotation.note : '';

    const buttonGroup = document.createElement('div');
    buttonGroup.style.display = 'flex';
    buttonGroup.style.gap = '10px';
    buttonGroup.style.justifyContent = 'flex-end';

    const saveButton = document.createElement('button');
    saveButton.textContent = 'Save';
    saveButton.style.padding = '8px 16px';
    saveButton.style.background = '#007bff';
    saveButton.style.color = 'white';
    saveButton.style.border = 'none';
    saveButton.style.borderRadius = '4px';
    saveButton.onclick = () => {
      if (annotation) {
        annotation.note = textarea.value;
        saveAnnotations();
        addNoteIndicator(span, annotation);
        editor.remove();
      }
    };

    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Cancel';
    cancelButton.style.padding = '8px 16px';
    cancelButton.style.background = '#6c757d';
    cancelButton.style.color = 'white';
    cancelButton.style.border = 'none';
    cancelButton.style.borderRadius = '4px';
    cancelButton.onclick = () => editor.remove();

    buttonGroup.appendChild(saveButton);
    buttonGroup.appendChild(cancelButton);

    editor.appendChild(textarea);
    editor.appendChild(buttonGroup);

    const rect = span.getBoundingClientRect();
    editor.style.top = `${rect.bottom + window.scrollY + 5}px`;
    editor.style.left = `${rect.left + window.scrollX}px`;

    document.body.appendChild(editor);
    textarea.focus();
  }

  function addNoteIndicator(span, annotation) {
    let indicator = span.querySelector('.note-indicator');
    if (!annotation.note) {
      if (indicator) indicator.remove();
      return;
    }
    if (!indicator) {
      indicator = document.createElement('span');
      indicator.className = 'note-indicator';
      indicator.textContent = ' 📝';
      indicator.style.cursor = 'pointer';
      indicator.onclick = (e) => {
        e.stopPropagation();
        showNoteEditor(span);
      };
      span.appendChild(indicator);
    }
  }

  // --- View Notes Table ---
  function displayNotes(btn) {
    const notesWindow = window.open('', 'Annotations', 'width=800,height=600');
    notesWindow.document.write(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Notes</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; }
          #report-title { font-size: 24px; padding: 8px; border: 1px solid #ccc; width: 60%; border-radius: 4px; }
          #report-title:focus { outline: none; border-color: #007bff; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
          th { background-color: #f8f9fa; }
          .edit-btn { padding: 6px 12px; background-color: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer; }
          #export-pdf { padding: 10px 20px; background-color: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer; }
        </style>
      </head>
      <body>
        <div class="header">
          <input type="text" id="report-title" value="Annotations Report" placeholder="Enter report title">
          <button id="export-pdf">Export as PDF</button>
        </div>
        <table>
          <thead>
            <tr>
              <th>Highlight</th>
              <th>Note</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="notes-container"></tbody>
        </table>
      </body>
      </html>
    `);

    const container = notesWindow.document.getElementById('notes-container');
    annotations.filter(a => a.pageUrl === window.location.href).forEach(annotation => {
      const row = notesWindow.document.createElement('tr');
      const textCell = notesWindow.document.createElement('td');
      textCell.textContent = annotation.text;
      const noteCell = notesWindow.document.createElement('td');
      noteCell.textContent = annotation.note || '';
      const actionCell = notesWindow.document.createElement('td');
      const editButton = notesWindow.document.createElement('button');
      editButton.className = 'edit-btn';
      editButton.textContent = 'Edit';
      editButton.onclick = () => {
        const newNote = notesWindow.prompt('Edit note:', annotation.note || '');
        if (newNote !== null) {
          annotation.note = newNote;
          saveAnnotations();
          noteCell.textContent = newNote || '';
        }
      };
      actionCell.appendChild(editButton);

      row.appendChild(textCell);
      row.appendChild(noteCell);
      row.appendChild(actionCell);
      container.appendChild(row);
    });

    notesWindow.document.getElementById('export-pdf').onclick = () => {
      exportAnnotationsPDF(
        notesWindow.document.getElementById('report-title').value
      );
    };

    setActiveBtn(btn);
  }

  // --- Direct PDF Export ---
  function exportAnnotationsPDF(reportTitle = "Annotations Report") {
    // Load jsPDF if not present

    const doc = window.jspdf ? new window.jspdf.jsPDF() : new window.jsPDF();
    let yPos = 20;
    const lineHeight = 8;
    const leftMargin = 10;
    const bulletIndent = 15;

    doc.setFontSize(18);
    doc.text(reportTitle, leftMargin, yPos);
    yPos += 15;

    doc.setFontSize(12);
    annotations.filter(a => a.pageUrl === window.location.href).forEach(ann => {
      doc.text('•', leftMargin, yPos);
      doc.text(ann.text, leftMargin + bulletIndent, yPos);
      yPos += lineHeight;

      if (ann.note) {
        doc.setFont('helvetica', 'italic');
        doc.text(`Note: ${ann.note}`, leftMargin + bulletIndent + 5, yPos);
        doc.setFont('helvetica', 'normal');
        yPos += lineHeight + 2;
      }
      yPos += 5;
      if (yPos > 280) {
        doc.addPage();
        yPos = 20;
      }
    });

    doc.save('annotations-report.pdf');
  }

  // --- Apply Annotations on Load ---
  function applyAnnotations() {
    document.querySelectorAll('.annotated-text').forEach(el => unwrapSpan(el));
    annotations.filter(a => a.pageUrl === window.location.href).forEach(annotation => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
      let node;
      while ((node = walker.nextNode())) {
        const idx = node.nodeValue.indexOf(annotation.text);
        if (idx !== -1) {
          const range = document.createRange();
          range.setStart(node, idx);
          range.setEnd(node, idx + annotation.text.length);
          const span = document.createElement('span');
          span.className = 'annotated-text';
          span.style.backgroundColor = annotation.color;
          span.textContent = annotation.text;
          span.setAttribute('data-ann-id', annotation.id);
          if (annotation.note) addNoteIndicator(span, annotation);
          range.deleteContents();
          range.insertNode(span);
          break;
        }
      }
    });
  }

  // --- Sidebar UI ---
  function setActiveBtn(btn) {
    document.querySelectorAll('#annotator-sidebar button').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    activeBtn = btn;
  }
  function clearActiveBtn() {
    document.querySelectorAll('#annotator-sidebar button').forEach(b => b.classList.remove('active'));
    activeBtn = null;
  }
  function clearModes() {
    highlightMode = false;
    eraseMode = false;
    noteMode = false;
    highlightColor = null;
    document.body.style.cursor = '';
    document.removeEventListener('mouseup', highlightHandler);
    document.removeEventListener('mousedown', eraseHandler);
    document.removeEventListener('click', noteHandler, true);
    document.removeEventListener('keydown', escHandler);
    clearActiveBtn();
    const existing = document.getElementById('note-editor');
    if (existing) existing.remove();
  }

  function escHandler(e) {
    if (e.key === 'Escape') clearModes();
  }

  function createSidebar() {
    if (document.getElementById('annotator-sidebar')) return;
    const sidebar = document.createElement('div');
    sidebar.id = 'annotator-sidebar';
    sidebar.innerHTML = `
      <div id="web">WA</div>
      <div class="button-group">
        <button class="color-btn yellow" aria-label="Yellow"><span class="tooltip">Yellow</span></button>
        <button class="color-btn green" aria-label="Green"><span class="tooltip">Green</span></button>
        <button class="color-btn blue" aria-label="Blue"><span class="tooltip">Blue</span></button>
        <button class="color-btn red" aria-label="Red"><span class="tooltip">Red</span></button>
        <button class="sidebar-btn" id="erase-btn" aria-label="Erase"><span class="tooltip">Erase</span>🧹</button>
        <button class="sidebar-btn" id="undo-btn" aria-label="Undo"><span class="tooltip">Undo</span>↩️</button>
        <button class="sidebar-btn" id="add-note-btn" aria-label="Notes"><span class="tooltip">Notes</span>📝</button>
        <button class="sidebar-btn" id="view-note-btn" aria-label="View Notes"><span class="tooltip">View Notes</span>📄</button>
        <button class="sidebar-btn" id="export-pdf-btn" aria-label="Export PDF"><span class="tooltip">Export PDF</span>📤</button>
      </div>
    `;
    document.body.appendChild(sidebar);

    sidebar.querySelector('.yellow').onclick = (e) => enableHighlightMode('yellow', e.currentTarget);
    sidebar.querySelector('.green').onclick = (e) => enableHighlightMode('lightgreen', e.currentTarget);
    sidebar.querySelector('.blue').onclick = (e) => enableHighlightMode('skyblue', e.currentTarget);
    sidebar.querySelector('.red').onclick = (e) => enableHighlightMode('red', e.currentTarget);
    sidebar.querySelector('#erase-btn').onclick = (e) => enableEraseMode(e.currentTarget);
    sidebar.querySelector('#undo-btn').onclick = (e) => undoErase(e.currentTarget);
    sidebar.querySelector('#add-note-btn').onclick = (e) => enableNoteMode(e.currentTarget);
    sidebar.querySelector('#view-note-btn').onclick = (e) => displayNotes(e.currentTarget);
    sidebar.querySelector('#export-pdf-btn').onclick = (e) => {
      setActiveBtn(e.currentTarget);
      exportAnnotationsPDF("Annotations Report");
    };
  }

  // --- Chrome Messaging ---
  chrome.runtime.onMessage.addListener((request) => {
    if (request.type === 'TOGGLE_SIDEBAR') {
      const sidebar = document.getElementById('annotator-sidebar');
      if (sidebar) {
        sidebar.remove();
        clearModes();
      } else {
        createSidebar();
      }
    }
  });

  // --- On Load ---
  document.addEventListener('DOMContentLoaded', () => {
    loadAnnotations(applyAnnotations);
    createSidebar();
  });

})();
