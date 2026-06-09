import { FaExternalLinkAlt } from 'react-icons/fa';
import styles from './ProjectCard.module.css';

const statusLabels = {
  idea: 'Idea',
  active: 'Active',
  paused: 'Paused',
  released: 'Released',
};

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
        <span className={`${styles.status} ${styles[project.status] || ''}`}>
          {statusLabels[project.status] || project.status}
        </span>
      </div>

      <div className={styles.body}>
        <h2>{project.title || 'Untitled project'}</h2>
        {project.role && <p className={styles.role}>{project.role}</p>}
        <p>{truncate(project.summary || project.descriptionText || 'No summary added yet.')}</p>
      </div>

      <div className={styles.footer}>
        <span>{project.type === 'collaboration' ? 'Collaboration' : 'Own project'}</span>
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
