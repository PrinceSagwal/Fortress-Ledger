import axios from 'axios';

const api = axios.create({
    baseURL: 'http://localhost:5000/api', // Points to Express backend
    withCredentials: true // CRITICAL: This allows the Http-Only cookie to be saved!
});

export default api;