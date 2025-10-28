import { DATE_WEEKDAY_LABELS_ES, DATE_MONTH_NAMES_ES } from './constants.js';

function aplicarEstilosBaseDatePickers() {
  const dateInputs = document.querySelectorAll('input[type="date"]');
  dateInputs.forEach(input => {
    if (input.dataset.skipDateEnhance === 'true') return;
    if (!input.dataset.dateEnhanced) {
      this.initModernDatePicker(input);
    } else {
      this.refreshModernDatePicker(input.id || input.name || '');
    }
  });
}

function initModernDatePicker(input) {
  if (!input || input.dataset.skipDateEnhance === 'true') return;
  if (input.dataset.dateEnhanced) {
    this.refreshModernDatePicker(input.id || input.name || '');
    return;
  }

  const ensureId = () => {
    if (input.id && input.id.trim() !== '') return input.id;
    const generated = `date-${Math.random().toString(36).slice(2, 8)}`;
    input.id = generated;
    return generated;
  };

  const inputId = ensureId();
  const placeholderInicial =
    input.dataset.placeholder ||
    input.getAttribute('data-placeholder') ||
    input.getAttribute('placeholder') ||
    'Seleccionar fecha...';

  const parent = input.parentNode;
  if (!parent) return;

  const wrapper = document.createElement('div');
  wrapper.className = 'modern-date';
  wrapper.tabIndex = 0;
  wrapper.setAttribute('role', 'button');
  wrapper.setAttribute('aria-haspopup', 'dialog');
  wrapper.setAttribute('aria-expanded', 'false');
  wrapper.dataset.dateId = inputId;

  const texts = document.createElement('div');
  texts.className = 'modern-date__texts';

  const labelSpan = document.createElement('span');
  labelSpan.className = 'modern-date__label';

  const valueSpan = document.createElement('span');
  valueSpan.className = 'modern-date__value modern-date__value--placeholder';
  valueSpan.textContent = placeholderInicial;

  texts.appendChild(labelSpan);
  texts.appendChild(valueSpan);

  const icon = document.createElement('span');
  icon.className = 'material-symbols-outlined modern-date__icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = 'calendar_month';

  parent.insertBefore(wrapper, input);
  wrapper.appendChild(texts);
  wrapper.appendChild(icon);
  wrapper.appendChild(input);

  const dropdown = document.createElement('div');
  dropdown.className = 'modern-date__dropdown hidden';
  dropdown.setAttribute('role', 'dialog');
  dropdown.setAttribute('aria-hidden', 'true');
  dropdown.dataset.dropdownFor = inputId;

  const header = document.createElement('div');
  header.className = 'modern-date__header';

  const prevBtn = document.createElement('button');
  prevBtn.type = 'button';
  prevBtn.className = 'modern-date__nav modern-date__nav--prev';
  const prevIcon = document.createElement('span');
  prevIcon.className = 'material-symbols-outlined';
  prevIcon.textContent = 'chevron_left';
  prevBtn.appendChild(prevIcon);

  const monthLabel = document.createElement('div');
  monthLabel.className = 'modern-date__month';

  const nextBtn = document.createElement('button');
  nextBtn.type = 'button';
  nextBtn.className = 'modern-date__nav modern-date__nav--next';
  const nextIcon = document.createElement('span');
  nextIcon.className = 'material-symbols-outlined';
  nextIcon.textContent = 'chevron_right';
  nextBtn.appendChild(nextIcon);

  header.appendChild(prevBtn);
  header.appendChild(monthLabel);
  header.appendChild(nextBtn);

  const weekdaysRow = document.createElement('div');
  weekdaysRow.className = 'modern-date__weekdays';
  DATE_WEEKDAY_LABELS_ES.forEach(label => {
    const span = document.createElement('span');
    span.textContent = label;
    weekdaysRow.appendChild(span);
  });

  const grid = document.createElement('div');
  grid.className = 'modern-date__grid';

  const footer = document.createElement('div');
  footer.className = 'modern-date__footer';

  const clearBtn = document.createElement('button');
  clearBtn.type = 'button';
  clearBtn.className = 'modern-date__action modern-date__action--ghost';
  clearBtn.textContent = 'Limpiar';

  const todayBtn = document.createElement('button');
  todayBtn.type = 'button';
  todayBtn.className = 'modern-date__action modern-date__action--primary';
  todayBtn.textContent = 'Hoy';

  footer.appendChild(clearBtn);
  footer.appendChild(todayBtn);

  dropdown.appendChild(header);
  dropdown.appendChild(weekdaysRow);
  dropdown.appendChild(grid);
  dropdown.appendChild(footer);
  wrapper.appendChild(dropdown);

  input.classList.add('modern-date__native');
  input.dataset.dateEnhanced = 'true';
  input.setAttribute('autocomplete', 'off');

  const state = {
    id: inputId,
    input,
    wrapper,
    labelSpan,
    valueSpan,
    dropdown,
    monthLabel,
    grid,
    placeholder: placeholderInicial,
    selectedDate: this.parseFechaValor(input.value),
    currentMonth: null,
    open: false,
    onDocumentClick: null,
    observer: null,
  };

  const updateLabel = () => {
    if (!labelSpan) return;
    const texto =
      this.obtenerTextoLabelCampo(inputId) ||
      state.labelText ||
      state.placeholder;
    labelSpan.textContent = texto;
    state.labelText = texto;
  };

  const ensureCurrentMonth = () => {
    if (state.currentMonth) return;
    if (state.selectedDate) {
      state.currentMonth = {
        year: state.selectedDate.year,
        month: state.selectedDate.month,
      };
      return;
    }
    const parsed = this.parseFechaValor(input.value);
    if (parsed) {
      state.currentMonth = { year: parsed.year, month: parsed.month };
      return;
    }
    const hoy = this.obtenerPartesHoy();
    state.currentMonth = { year: hoy.year, month: hoy.month };
  };

  const updateDisplay = () => {
    if (!valueSpan) return;
    const valor = input.value;
    const tieneValor = Boolean(valor);
    const actualPlaceholder = state.placeholder || placeholderInicial;
    if (!tieneValor) {
      valueSpan.textContent = actualPlaceholder;
      valueSpan.classList.add('modern-date__value--placeholder');
      return;
    }
    const partes = this.parseFechaValor(valor);
    if (!partes) {
      valueSpan.textContent = actualPlaceholder;
      valueSpan.classList.add('modern-date__value--placeholder');
      return;
    }
    const texto = this.formatearFechaDisplay(valor);
    valueSpan.textContent = texto || actualPlaceholder;
    valueSpan.classList.toggle('modern-date__value--placeholder', !texto);
  };

  const updateDisabledState = () => {
    wrapper.classList.toggle('modern-date--disabled', input.disabled);
    if (input.disabled) {
      closeDropdown();
    }
  };

  const buildCalendar = () => {
    ensureCurrentMonth();
    if (!grid || !state.currentMonth) return;

    const { year, month } = state.currentMonth;
    const firstDay = new Date(Date.UTC(year, month, 1));
    const startingDay = firstDay.getUTCDay() || 7;
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const selectedIso = state.selectedDate ? this.formatearFechaISO(state.selectedDate) : input.value;

    if (state.monthLabel) {
      const monthName = DATE_MONTH_NAMES_ES[month] || '';
      state.monthLabel.textContent = `${this.capitalizarFrase(monthName)} ${year}`;
    }

    const fragment = document.createDocumentFragment();
    const totalCells = Math.ceil((startingDay - 1 + daysInMonth) / 7) * 7;

    for (let index = 0; index < totalCells; index += 1) {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'modern-date__cell';

      const dayOffset = index - (startingDay - 1);
      const date = dayOffset + 1;

      if (date < 1 || date > daysInMonth) {
        cell.classList.add('modern-date__cell--empty');
        cell.disabled = true;
      } else {
        const iso = this.formatearFechaISO({ year, month, day: date });
        cell.textContent = String(date);
        cell.dataset.date = iso;
        cell.classList.add('modern-date__cell--day');

        const isToday = (() => {
          const hoy = this.obtenerPartesHoy();
          return hoy.year === year && hoy.month === month && hoy.day === date;
        })();

        if (isToday) {
          cell.classList.add('modern-date__cell--today');
        }

        if (iso === selectedIso) {
          cell.classList.add('modern-date__cell--selected');
        }

        cell.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          this.formatearFechaISO({ year, month, day: date });
          selectDate(year, month, date);
        });
      }

      fragment.appendChild(cell);
    }

    grid.innerHTML = '';
    grid.appendChild(fragment);
  };

  const closeDropdown = () => {
    if (!state.open) return;
    state.open = false;
    dropdown.classList.add('hidden');
    wrapper.classList.remove('modern-date--open');
    wrapper.setAttribute('aria-expanded', 'false');
    dropdown.setAttribute('aria-hidden', 'true');
    document.removeEventListener('click', state.onDocumentClick);
  };

  const openDropdown = () => {
    if (state.open) return;
    ensureCurrentMonth();
    state.open = true;
    dropdown.classList.remove('hidden');
    wrapper.classList.add('modern-date--open');
    wrapper.setAttribute('aria-expanded', 'true');
    dropdown.setAttribute('aria-hidden', 'false');
    document.addEventListener('click', state.onDocumentClick);
    buildCalendar();
    requestAnimationFrame(() => dropdown.focus({ preventScroll: true }));
  };

  state.onDocumentClick = (event) => {
    if (!wrapper.contains(event.target)) {
      closeDropdown();
    }
  };

  const handleFocus = () => {
    wrapper.classList.add('modern-date--focused');
  };

  const handleBlur = () => {
    wrapper.classList.remove('modern-date--focused');
  };

  const goToMonth = (delta) => {
    ensureCurrentMonth();
    if (!state.currentMonth) return;
    let { year, month } = state.currentMonth;
    month += delta;
    while (month < 0) {
      month += 12;
      year -= 1;
    }
    while (month > 11) {
      month -= 12;
      year += 1;
    }
    state.currentMonth = { year, month };
    buildCalendar();
  };

  const selectDate = (year, month, day) => {
    const iso = this.formatearFechaISO({ year, month, day });
    if (!iso) return;
    const previousValue = input.value;
    if (previousValue !== iso) {
      input.value = iso;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
    state.selectedDate = { year, month, day };
    state.currentMonth = { year, month };
    updateDisplay();
    buildCalendar();
    closeDropdown();
  };

  const clearDate = () => {
    if (!input.value) {
      updateDisplay();
      buildCalendar();
      return;
    }
    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    state.selectedDate = null;
    updateDisplay();
    buildCalendar();
  };

  const goToToday = () => {
    const hoy = this.obtenerPartesHoy();
    selectDate(hoy.year, hoy.month, hoy.day);
  };

  const handleWrapperClick = (event) => {
    if (input.disabled) return;
    event.preventDefault();
    event.stopPropagation();
    state.open ? closeDropdown() : openDropdown();
  };

  const handleWrapperKey = (event) => {
    if (input.disabled) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      state.open ? closeDropdown() : openDropdown();
    } else if (event.key === 'Escape') {
      if (state.open) {
        event.preventDefault();
        closeDropdown();
      }
    } else if (event.key === 'ArrowDown' && !state.open) {
      event.preventDefault();
      openDropdown();
    } else if (event.key === 'ArrowLeft' && state.open) {
      event.preventDefault();
      goToMonth(-1);
    } else if (event.key === 'ArrowRight' && state.open) {
      event.preventDefault();
      goToMonth(1);
    }
  };

  wrapper.addEventListener('click', handleWrapperClick);
  wrapper.addEventListener('keydown', handleWrapperKey);
  wrapper.addEventListener('focus', handleFocus);
  wrapper.addEventListener('blur', handleBlur);

  dropdown.addEventListener('click', (event) => event.stopPropagation());

  prevBtn.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    goToMonth(-1);
  });

  nextBtn.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    goToMonth(1);
  });

  clearBtn.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    clearDate();
  });

  todayBtn.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    goToToday();
  });

  input.addEventListener('input', updateDisplay);
  input.addEventListener('change', updateDisplay);
  input.addEventListener('focus', handleFocus);
  input.addEventListener('blur', handleBlur);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && state.open) {
      event.preventDefault();
      closeDropdown();
      wrapper.focus({ preventScroll: true });
    }
  });

  let observer = null;
  if (typeof MutationObserver === 'function') {
    observer = new MutationObserver(() => {
      updateDisabledState();
    });
    observer.observe(input, { attributes: true, attributeFilter: ['disabled'] });
  }
  state.observer = observer;

  const form = input.form;
  if (form && !form.dataset.hasModernDateResetListener) {
    form.addEventListener('reset', () => {
      requestAnimationFrame(() => {
        this.aplicarEstilosBaseDatePickers();
      });
    });
    form.dataset.hasModernDateResetListener = 'true';
  }

  state.updateLabel = updateLabel;
  state.updateDisplay = updateDisplay;
  state.updateDisabledState = updateDisabledState;
  state.buildCalendar = buildCalendar;
  state.openDropdown = openDropdown;
  state.closeDropdown = closeDropdown;
  state.goToMonth = goToMonth;
  state.selectDate = selectDate;
  state.clearDate = clearDate;

  this.components.datePickers.set(inputId, state);

  updateLabel();
  updateDisplay();
  updateDisabledState();
  ensureCurrentMonth();
  buildCalendar();
}

function refreshModernDatePicker(id) {
  if (!id) return;
  const input = document.getElementById(id);
  if (!input) return;
  if (input.dataset.skipDateEnhance === 'true') return;

  const inputId = input.id || input.name || id;
  const state = this.components.datePickers.get(inputId);
  if (!state) {
    if (!input.dataset.dateEnhanced) {
      this.initModernDatePicker(input);
    }
    return;
  }

  state.placeholder = input.dataset.placeholder || input.getAttribute('data-placeholder') || state.placeholder;
  state.updateLabel?.();
  state.updateDisplay?.();
  state.updateDisabledState?.();
  state.buildCalendar?.();
}

export const datePickerMethods = {
  aplicarEstilosBaseDatePickers,
  initModernDatePicker,
  refreshModernDatePicker
};
