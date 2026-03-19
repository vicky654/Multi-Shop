import api from './axios';

export const rolesApi = {
  getAll:       ()       => api.get('/roles'),
  getOne:       (id)     => api.get(`/roles/${id}`),
  create:       (data)   => api.post('/roles', data),
  update:       (id, d)  => api.put(`/roles/${id}`, d),
  delete:       (id)     => api.delete(`/roles/${id}`),
  getPermissions: ()     => api.get('/roles/permissions'),
};
