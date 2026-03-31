import axios from './axios';

export const parserApi = {
  // Extract from plain text (bill/expense text)
  extractFromText: (text) =>
    axios.post('/parser/extract', { text }),

  // Extract from image file (Bill/receipt photo)
  extractFromImage: (file) => {
    const form = new FormData();
    form.append('image', file);
    return axios.post('/parser/extract', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};
