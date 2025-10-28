import apiService from '../actividades/api.js';

export async function callBackend(path, payload = {}, options = {}) {
  return apiService.callBackend(path, payload, options);
}

export async function fetchActividades(options = {}) {
  return apiService.fetchActividades(options);
}

export async function fetchAvances(options = {}) {
  return apiService.fetchAvances(options);
}

export async function saveAvance(payload) {
  return apiService.saveAvance(payload);
}

export async function reviewAvance(payload) {
  return apiService.reviewAvance(payload);
}
