import axios from 'axios';

// Replace with your actual Azure Function URL
const API_BASE_URL = 'https://func-invoice-v2.azurewebsites.net/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const invoiceAPI = {
  // Upload invoice
  uploadInvoice: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await axios.post(`${API_BASE_URL}/uploadinvoice`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // Get all invoices
  getAllInvoices: async (status = null) => {
    const url = status 
      ? `${API_BASE_URL}/getinvoices?status=${status}`
      : `${API_BASE_URL}/getinvoices`;
    const response = await api.get(url);
    return response.data;
  },

  // Get single invoice
  getInvoice: async (id) => {
    const response = await api.get(`/invoices/${id}`);
    return response.data;
  },

  // Get invoice logs
  getInvoiceLogs: async (id) => {
    const response = await api.get(`/invoices/${id}/logs`);
    return response.data;
  },

  // Update invoice status
  updateInvoiceStatus: async (id, status, errorMessage = null) => {
    const response = await api.patch(`/invoices/${id}/status`, {
      status,
      errorMessage,
    });
    return response.data;
  },
};

export default api;