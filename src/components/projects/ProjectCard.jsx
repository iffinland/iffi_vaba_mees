import { FaExternalLinkAlt } from 'react-icons/fa';
import { getProjectStatusClass, PROJECT_STATUS_LABELS, PROJECT_TYPE_LABELS } from '../../utils/projectDisplay';
import styles from './ProjectCard.module.css';

const truncate = (value = '', max = 220) => {
  if (value.length <= max) return value;
  return `${value.slice(0, max).trim()}...`;
};

function ProjectCard({ onOpenDetail, project }) {
  const handleKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onOpenDetail(project);
    }
  };

  const statusClass = getProjectStatusClass(project.status);

  return (
    <article
      className={styles.card}
      onClick={() => onOpenDetail(project)}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
    >
      <div className={styles.cover}>
        {project.coverUrl ? (
          <img src={project.coverUrl} alt={project.title || 'Project cover'} />
        ) : (
          <div className={styles.coverPlaceholder}>Project</div>
        )}
        <div className={styles.badges}>
          <span className={`${styles.status} ${statusClass ? styles[statusClass] : ''}`}>
            {PROJECT_STATUS_LABELS[project.status] || project.status}
          </span>
          {project.mainProject && (
            <span className={styles.mainProjectBadge}>{project.mainProject}</span>
          )}
        </div>
      </div>

      <div className={styles.body}>
        <h2>{project.title || 'Untitled project'}</h2>
        {project.role && <p className={styles.role}>{project.role}</p>}
        <p>{truncate(project.summary || project.descriptionText || 'No summary added yet.')}</p>
      </div>

      <div className={styles.footer}>
        <span>{PROJECT_TYPE_LABELS[project.type] || 'Project'}</span>
        {project.links.length > 0 && (
          <span className={styles.linkHint}>
            <FaExternalLinkAlt />
            {project.links.length}
          </span>
        )}
      </div>
    </article>
  );
}

export default ProjectCard;
