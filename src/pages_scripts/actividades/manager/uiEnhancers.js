import { selectEnhancerMethods } from './selectEnhancers.js';
import { datePickerMethods } from './datePickers.js';
import { multiSelectMethods } from './multiSelect.js';

export const uiEnhancerMethods = {
  ...selectEnhancerMethods,
  ...datePickerMethods,
  ...multiSelectMethods
};
