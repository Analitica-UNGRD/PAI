const TYPO_URL = new URL('../vendor/typo.min.js', import.meta.url);
const AFF_URL = new URL('../dict/es_ES.aff', import.meta.url);
const DIC_URL = new URL('../dict/es_ES.dic', import.meta.url);

let typoLoaderPromise = null;
let dictionaryPromise = null;
let spinnerStylesInjected = false;

function ensureHTMLElement(element) {
  if (!element) {
    throw new Error('Se requiere un elemento válido para inicializar el editor.');
  }
  return typeof element === 'string' ? document.querySelector(element) : element;
}

function loadTypoScript() {
  if (typeof window !== 'undefined' && window.Typo) {
    return Promise.resolve(window.Typo);
  }

  if (!typoLoaderPromise) {
    typoLoaderPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = TYPO_URL.href;
      script.async = true;
      script.onload = () => {
        if (window.Typo) {
          resolve(window.Typo);
        } else {
          reject(new Error('Typo.js no definió el símbolo "Typo" en window.'));
        }
      };
      script.onerror = () => reject(new Error('No se pudo cargar typo.min.js'));
      document.head.appendChild(script);
    });
  }

  return typoLoaderPromise;
}

function ensureSpinnerStyles() {
  if (spinnerStylesInjected || typeof document === 'undefined') return;
  const style = document.createElement('style');
  style.id = 'orthography-spinner-styles';
  style.textContent = `@keyframes orthography-spin{from{transform:rotate(0deg);}to{transform:rotate(360deg);}}` +
    `.orthography-spinner{display:inline-block;animation:orthography-spin 0.8s linear infinite;}`;
  document.head.appendChild(style);
  spinnerStylesInjected = true;
}

async function loadDictionary() {
  if (dictionaryPromise) {
    return dictionaryPromise;
  }

  dictionaryPromise = (async () => {
    const TypoCtor = await loadTypoScript();
    const [affData, dicData] = await Promise.all([
      fetch(AFF_URL).then((res) => {
        if (!res.ok) throw new Error(`No se pudo cargar el archivo AFF (${res.status})`);
        return res.text();
      }),
      fetch(DIC_URL).then((res) => {
        if (!res.ok) throw new Error(`No se pudo cargar el archivo DIC (${res.status})`);
        return res.text();
      })
    ]);
    return new TypoCtor('es_ES', affData, dicData, { platform: 'any' });
  })();

  return dictionaryPromise;
}

function getSelectionOffset(root) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  const preRange = range.cloneRange();
  preRange.selectNodeContents(root);
  preRange.setEnd(range.startContainer, range.startOffset);
  return preRange.toString().length;
}

function setSelectionOffset(root, offset) {
  if (offset === null || offset === undefined) return;
  const selection = window.getSelection();
  const range = document.createRange();
  let currentOffset = 0;

  function traverse(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const nextOffset = currentOffset + node.textContent.length;
      if (offset <= nextOffset) {
        range.setStart(node, Math.max(0, offset - currentOffset));
        range.collapse(true);
        return true;
      }
      currentOffset = nextOffset;
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      for (const child of node.childNodes) {
        const found = traverse(child);
        if (found) return true;
      }
    }
    return false;
  }

  traverse(root);
  if (selection) {
    selection.removeAllRanges();
    selection.addRange(range);
  }
}

function tokenize(text) {
  const tokens = [];
  const wordRegex = /[\p{L}\p{M}'_-]+/gu;
  let lastIndex = 0;
  let match;

  while ((match = wordRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ type: 'text', value: text.slice(lastIndex, match.index) });
    }
    tokens.push({ type: 'word', value: match[0], index: match.index });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    tokens.push({ type: 'text', value: text.slice(lastIndex) });
  }

  return tokens;
}

function normalizeWord(word) {
  if (!word) return '';
  return word
    .replace(/^[^\p{L}\p{M}]+/u, '')
    .replace(/[^\p{L}\p{M}]+$/u, '')
  .replace(/['']/g, "'")
    .trim();
}

function isLikelyWord(word) {
  if (!word) return false;
  const letters = word.replace(/[^\p{L}\p{M}']/gu, '');
  return letters.length > 1; // evita letras sueltas
}

class OrthographyChecker {
  constructor(options) {
    const {
      editor,
      panel,
      button,
      hiddenInput,
      counterElement,
      firstSuggestionElement,
      autoCheck = true,
      maxSuggestions = 5,
      dictionaryReadyCallback = null
    } = options || {};

    this.editor = ensureHTMLElement(editor);
    this.panel = panel ? ensureHTMLElement(panel) : null;
    this.button = button ? ensureHTMLElement(button) : null;
    this.hiddenInput = hiddenInput ? ensureHTMLElement(hiddenInput) : null;
    this.counterElement = counterElement ? ensureHTMLElement(counterElement) : null;
    this.firstSuggestionElement = firstSuggestionElement ? ensureHTMLElement(firstSuggestionElement) : null;
    this.maxSuggestions = maxSuggestions;
    this.autoCheck = autoCheck;
    this.dictionaryReadyCallback = typeof dictionaryReadyCallback === 'function' ? dictionaryReadyCallback : null;

    this.errors = [];
    this.suggestionCache = new WeakMap();
    this.debouncedCheck = null;
    this.isDestroyed = false;
    this.ignoredWords = new Set();

    this.editor.setAttribute('contenteditable', 'true');
    this.editor.setAttribute('spellcheck', 'false');
    this.editor.classList.add('orthography-editor');

    if (this.hiddenInput) {
      this.hiddenInput.setAttribute('hidden', '');
      this.hiddenInput.style.display = 'none';
    }

    if (!this.hiddenInput) {
      this.hiddenInput = document.createElement('textarea');
      this.hiddenInput.name = this.editor.getAttribute('data-field-name') || '';
      this.hiddenInput.classList.add('orthography-hidden-input');
      this.hiddenInput.hidden = true;
      if (this.editor.parentElement) {
        this.editor.parentElement.appendChild(this.hiddenInput);
      }
    }

    this.menu = document.createElement('div');
    this.menu.className = 'orthography-suggestions-menu';
    this.menu.hidden = true;
    document.body.appendChild(this.menu);

    this.boundHandleInput = this.handleInput.bind(this);
    this.boundHandleClick = this.handleClick.bind(this);
    this.boundHandleDocumentClick = this.handleDocumentClick.bind(this);
    this.boundHandleScroll = () => this.hideMenu();

    this.attachEvents();
    this.ready = this.initialize();
  }

  attachEvents() {
    this.editor.addEventListener('input', this.boundHandleInput);
    this.editor.addEventListener('click', this.boundHandleClick);
    document.addEventListener('click', this.boundHandleDocumentClick);
    window.addEventListener('scroll', this.boundHandleScroll, true);

    if (this.button) {
      this.button.addEventListener('click', (event) => {
        event.preventDefault();
        this.runSpellcheck({ force: true });
      });
    }
  }

  async initialize() {
    this.typo = await loadDictionary();
    if (this.dictionaryReadyCallback) {
      try {
        this.dictionaryReadyCallback();
      } catch (error) {
        console.warn('Callback de diccionario lanzó un error:', error);
      }
    }

    const initialText = this.hiddenInput?.value || this.editor.innerText;
    this.setText(initialText || '');
    if (this.autoCheck) {
      await this.runSpellcheck({ force: true });
    }
  }

  destroy() {
    if (this.isDestroyed) return;
    this.isDestroyed = true;

    this.editor.removeEventListener('input', this.boundHandleInput);
    this.editor.removeEventListener('click', this.boundHandleClick);
    document.removeEventListener('click', this.boundHandleDocumentClick);
    window.removeEventListener('scroll', this.boundHandleScroll, true);
    this.hideMenu();
    this.menu.remove();
  }

  handleInput() {
    this.syncHiddenField();
    if (!this.autoCheck) return;
    if (this.debouncedCheck) {
      clearTimeout(this.debouncedCheck);
    }
    this.debouncedCheck = setTimeout(() => {
      this.runSpellcheck();
    }, 200);
  }

  handleClick(event) {
    const target = event.target;
    if (target && target.classList && target.classList.contains('orthography-error')) {
      event.stopPropagation();
      this.showMenu(target);
    } else {
      this.hideMenu();
    }
  }

  handleDocumentClick(event) {
    if (!this.menu.hidden && !this.menu.contains(event.target)) {
      this.hideMenu();
    }
  }

  syncHiddenField() {
    if (!this.hiddenInput) return;
    const text = this.getPlainText();
    this.hiddenInput.value = text;
  }

  getPlainText() {
    return this.editor.innerText.replace(/\u00A0/g, ' ').trimEnd();
  }

  setText(text) {
    if (this.editor instanceof HTMLTextAreaElement || this.editor instanceof HTMLInputElement) {
      this.editor.value = text;
    } else {
      this.editor.textContent = text;
    }
    this.syncHiddenField();
  }

  async runSpellcheck({ force = false } = {}) {
    if (!force && !this.autoCheck) return;
    // Ensure dictionary/Typo instance is available.
    if (!this.typo) {
      await this.ready;
      if (!this.typo) {
        try {
          this.typo = await loadDictionary();
          if (this.dictionaryReadyCallback) {
            try { this.dictionaryReadyCallback(); } catch (_) { /* ignore */ }
          }
        } catch (err) {
          console.error('No se pudo cargar el diccionario de ortografía:', err);
          if (this.firstSuggestionElement) {
            this.firstSuggestionElement.textContent = 'No se pudo cargar el diccionario. Comprueba la conexión y vuelve a intentar.';
          } else if (this.panel) {
            const node = this.panel.querySelector('[data-orthography-first]');
            if (node) node.textContent = 'No se pudo cargar el diccionario. Comprueba la conexión y vuelve a intentar.';
          }
          this.updatePanel();
          return;
        }
      }
    }

    const caretOffset = getSelectionOffset(this.editor);
    const text = this.getPlainText();
    const tokens = tokenize(text);

    const fragment = document.createDocumentFragment();
    const errors = [];

    for (const token of tokens) {
      if (token.type === 'text') {
        fragment.appendChild(document.createTextNode(token.value));
        continue;
      }

      const rawWord = token.value;
      const normalized = normalizeWord(rawWord);
      const normalizedLower = normalized.toLowerCase();

      if (!isLikelyWord(normalizedLower) || this.ignoredWords.has(normalizedLower) || this.typo.check(normalizedLower)) {
        fragment.appendChild(document.createTextNode(rawWord));
        continue;
      }

      const span = document.createElement('span');
      span.className = 'orthography-error';
      span.dataset.original = rawWord;
      span.dataset.normalized = normalizedLower;
      span.textContent = rawWord;

      const suggestionsRaw = this.typo.suggest(normalizedLower, this.maxSuggestions) || [];
      const suggestions = suggestionsRaw.map((suggestion) => {
        if (!suggestion) return suggestion;
        if (rawWord === rawWord.toUpperCase()) return suggestion.toUpperCase();
        if (rawWord[0] === rawWord[0]?.toUpperCase()) {
          return suggestion.charAt(0).toUpperCase() + suggestion.slice(1);
        }
        return suggestion;
      });
      this.suggestionCache.set(span, suggestions);

      fragment.appendChild(span);
      errors.push({ word: normalized, element: span, suggestions });
    }

    this.editor.replaceChildren(fragment);
    this.errors = errors;
    setSelectionOffset(this.editor, caretOffset);
    this.syncHiddenField();
    this.updatePanel();

    // Notify listeners that a spellcheck run has completed on this editor
    try {
      this.editor.dispatchEvent(new CustomEvent('orthography:checked', { detail: { errors: this.errors.slice() } }));
    } catch (e) {
      // ignore
    }
  }

  updatePanel() {
    const count = this.errors.length;
    const label = `Ortografía: ${count} ${count === 1 ? 'error' : 'errores'}`;

    if (this.counterElement) {
      this.counterElement.textContent = label;
    } else if (this.panel) {
      const countNode = this.panel.querySelector('[data-orthography-count]');
      if (countNode) {
        countNode.textContent = label;
      } else {
        this.panel.querySelector('.orthography-count')?.remove();
        const summary = document.createElement('div');
        summary.className = 'orthography-count';
        summary.textContent = label;
        this.panel.prepend(summary);
      }
    }

    const firstError = this.errors[0];
    let suggestionText = 'Sin errores.';
    if (firstError) {
      const firstSuggestion = firstError.suggestions?.[0];
      if (firstSuggestion) {
        suggestionText = `Sugerencia: ${firstSuggestion}`;
      } else {
  suggestionText = `Sin sugerencias para "${firstError.word}".`;
      }
    }

    if (this.firstSuggestionElement) {
      this.firstSuggestionElement.textContent = suggestionText;
    } else if (this.panel) {
      const suggestionNode = this.panel.querySelector('[data-orthography-first]');
      if (suggestionNode) {
        suggestionNode.textContent = suggestionText;
      } else {
        let slot = this.panel.querySelector('.orthography-first-suggestion');
        if (!slot) {
          slot = document.createElement('div');
          slot.className = 'orthography-first-suggestion';
          this.panel.append(slot);
        }
        slot.textContent = suggestionText;
      }
    }
  }

  showMenu(target) {
    const suggestions = this.suggestionCache.get(target) || [];
    this.menu.innerHTML = '';

    const title = document.createElement('div');
    title.className = 'orthography-menu-title';
  title.textContent = `Reemplazar "${target.textContent}"`;
    this.menu.appendChild(title);

    if (suggestions.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'orthography-menu-empty';
      empty.textContent = 'Sin sugerencias';
      this.menu.appendChild(empty);
    } else {
      suggestions.slice(0, this.maxSuggestions).forEach((suggestion) => {
        const option = document.createElement('button');
        option.type = 'button';
        option.className = 'orthography-menu-option';
        option.textContent = suggestion;
        option.addEventListener('click', () => {
          this.replaceWord(target, suggestion);
          this.hideMenu();
        });
        this.menu.appendChild(option);
      });
    }

    const ignore = document.createElement('button');
    ignore.type = 'button';
    ignore.className = 'orthography-menu-ignore';
    ignore.textContent = 'Ignorar';
    ignore.addEventListener('click', () => {
      this.ignoreWord(target);
    });
    this.menu.appendChild(ignore);

    const rect = target.getBoundingClientRect();
    this.menu.style.top = `${rect.bottom + window.scrollY + 4}px`;
    this.menu.style.left = `${rect.left + window.scrollX}px`;
    this.menu.hidden = false;
  }

  hideMenu() {
    if (!this.menu.hidden) {
      this.menu.hidden = true;
      this.menu.innerHTML = '';
    }
  }

  replaceWord(element, replacement) {
    element.replaceWith(document.createTextNode(replacement));
    this.syncHiddenField();
    this.runSpellcheck({ force: true });
  }

  ignoreWord(element) {
    const normalized = element.dataset.normalized;
    if (normalized) {
      this.ignoredWords.add(normalized.toLowerCase());
    }
    element.replaceWith(document.createTextNode(element.textContent));
    this.hideMenu();
    this.syncHiddenField();
    this.runSpellcheck({ force: true });
  }
}

export async function createOrthographyChecker(options) {
  const checker = new OrthographyChecker(options);
  await checker.ready;
  return checker;
}

export { OrthographyChecker };

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-orthography-editor]').forEach((editor) => {
    if (editor.__orthographyInitialized) return;

    const panelSelector = editor.getAttribute('data-orthography-panel');
    const buttonSelector = editor.getAttribute('data-orthography-button');
    const counterSelector = editor.getAttribute('data-orthography-counter');
    const suggestionSelector = editor.getAttribute('data-orthography-first');
    const hiddenSelector = editor.getAttribute('data-orthography-hidden');

    const baseOptions = {
      editor,
      panel: panelSelector ? document.querySelector(panelSelector) : null,
      counterElement: counterSelector ? document.querySelector(counterSelector) : null,
      firstSuggestionElement: suggestionSelector ? document.querySelector(suggestionSelector) : null,
      hiddenInput: hiddenSelector ? document.querySelector(hiddenSelector) : null
    };

    // If a verification button is provided, defer initialization until the user clicks it.
    if (buttonSelector) {
      const btn = document.querySelector(buttonSelector);
      if (!btn) {
        console.warn('Botón de verificación especificado no encontrado:', buttonSelector);
        return;
      }

      let checkerPromise = null;
      // Mark editor as initialized to avoid duplicate wiring
      editor.__orthographyInitialized = true;

      btn.addEventListener('click', async (ev) => {
        ev.preventDefault();
        btn.disabled = true;
        const originalHTML = btn.innerHTML;
        ensureSpinnerStyles();
        btn.innerHTML = '<span class="material-symbols-outlined orthography-spinner">autorenew</span> Verificando...';
  await new Promise((resolve) => setTimeout(resolve, 0));

        try {
          if (!checkerPromise) {
            const options = Object.assign({}, baseOptions, { button: btn, autoCheck: false });
            checkerPromise = createOrthographyChecker(options).catch((err) => {
              checkerPromise = null; throw err;
            });
          }

          const checker = await checkerPromise;
          // Attach checker instance to the editor so other scripts can reference it
          editor.__orthographyChecker = checker;
          // Run a forced spellcheck when the user clicks.
          await checker.runSpellcheck({ force: true });
        } catch (err) {
          console.error('Error inicializando/verificando ortografía:', err);
        } finally {
          btn.disabled = false;
          btn.innerHTML = originalHTML;
        }
      });

    } else {
      // No button: initialize immediately and allow auto-checking behavior.
      editor.__orthographyInitialized = true;
      const options = Object.assign({}, baseOptions, { autoCheck: true, button: null });
      createOrthographyChecker(options)
        .then((checker) => { editor.__orthographyChecker = checker; })
        .catch((error) => {
          console.error('No se pudo inicializar el validador ortográfico:', error);
          editor.__orthographyInitialized = false;
        });
    }
  });
});
