export const PROJECT_STATUS_LABELS = {
  idea: 'Idea',
  active: 'Active',
  paused: 'Paused',
  released: 'Released',
};

export const PROJECT_TYPE_LABELS = {
  own: 'Own project',
  collaboration: 'Collaboration project',
};

export const getProjectStatusClass = (status) => {
  const normalized = String(status || '').trim().toLowerCase();
  if (PROJECT_STATUS_LABELS[normalized]) return normalized;
  return '';
};
