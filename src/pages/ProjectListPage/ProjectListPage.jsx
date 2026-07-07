import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { FaPlus, FaSearch } from 'react-icons/fa';
import ProjectCard from '../../components/projects/ProjectCard';
import ProjectPublishModal from '../../components/projects/ProjectPublishModal';
import { useProjects } from '../../hooks/useProjects';
import { isOwnerProfile } from '../../utils/siteConfig';
import styles from './ProjectListPage.module.css';

const typeConfig = {
  own: {
    title: 'My Own Projects',
    description: 'Projects I created, maintain, or shape as the main builder.',
  },
  collaboration: {
    title: 'Collaboration Projects',
    description: 'Projects where I contribute as a collaborator, translator, builder, or helper.',
  },
};

const normalizeProjectType = (value) =>
  value === 'collaboration' ? 'collaboration' : 'own';

function ProjectListPage() {
  const navigate = useNavigate();
  const { projectType } = useParams();
  const normalizedType = normalizeProjectType(projectType);
  const [isPublishOpen, setIsPublishOpen] = useState(false);
  const [toast, setToast] = useState('');
  const {
    error,
    hasNextPage,
    isLoading,
    isPublishing,
    page,
    profile,
    projects,
    publishNewProject,
    searchQuery,
    setPage,
    setSearchQuery,
    setSortOrder,
    setStatus,
    sortOrder,
    status,
  } = useProjects(normalizedType);

  const config = useMemo(() => typeConfig[normalizedType], [normalizedType]);
  const canPublishProjects = isOwnerProfile(profile);

  const notify = (message) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 2600);
  };

  const openProjectDetail = (project) => {
    navigate(`/projects/item/${encodeURIComponent(project.identifier)}`);
  };

  const handlePublish = async (form) => {
    await publishNewProject(form);
    notify('Project published successfully.');
  };

  return (
    <section className={styles.page}>
      {toast && <div className={styles.toast}>{toast}</div>}

      <Link to="/projects" className={styles.backLink}>Back to projects overview</Link>

      <div className={styles.hero}>
        <div>
          <h1>{config.title}</h1>
          <p>{config.description}</p>
        </div>
        {canPublishProjects && (
          <button type="button" className={styles.publishButton} onClick={() => setIsPublishOpen(true)}>
            <FaPlus />
            <span>Publish project</span>
          </button>
        )}
      </div>

      <div className={styles.toolbar}>
        <label className={styles.searchBox}>
          <FaSearch />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search projects"
          />
        </label>

        <label className={styles.sortBox}>
          Sort
          <select value={sortOrder} onChange={(event) => setSortOrder(event.target.value)}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </label>

        <label className={styles.sortBox}>
          Status
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">All statuses</option>
            <option value="idea">Idea</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="released">Released</option>
          </select>
        </label>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      {isLoading ? (
        <p className={styles.status}>Loading projects...</p>
      ) : projects.length === 0 ? (
        <p className={styles.status}>No projects found.</p>
      ) : (
        <div className={styles.grid}>
          {projects.map((project) => (
            <ProjectCard
              key={project.identifier}
              onOpenDetail={openProjectDetail}
              project={project}
            />
          ))}
        </div>
      )}

      <div className={styles.pagination}>
        <button type="button" onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1 || isLoading}>
          Previous
        </button>
        <span>Page {page}</span>
        <button type="button" onClick={() => setPage(page + 1)} disabled={!hasNextPage || isLoading}>
          Next
        </button>
      </div>

      <ProjectPublishModal
        fixedType={normalizedType}
        isOpen={canPublishProjects && isPublishOpen}
        isPublishing={isPublishing}
        onClose={() => setIsPublishOpen(false)}
        onPublish={handlePublish}
      />
    </section>
  );
}

export default ProjectListPage;
