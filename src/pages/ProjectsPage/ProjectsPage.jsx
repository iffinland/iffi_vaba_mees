import { Link } from 'react-router-dom';
import styles from './ProjectsPage.module.css';
import projectsImage from '../../assets/poster-my-projects.webp';

function ProjectsPage() {
  return (
    <div className={styles.container}>
      <img src={projectsImage} alt="iffi's various projects" className={styles.pageImage} />
      <h1 className={styles.title}>iffi's various projects</h1>
      <h4><strong>This is the projects page. An overview of the projects I am working on or in.</strong></h4>

      <div className={styles.tabContainer}>
        <Link className={styles.tabButton} to="/projects/own">
          My Own Projects
        </Link>
        <Link className={styles.tabButton} to="/projects/collaboration">
          Collaboration Projects
        </Link>
      </div>

      <div className={styles.tabContent}>
        <h2>Choose a project section</h2>
        <p>
          My own projects and collaboration projects now have separate pages with project
          status, roles, goals, roadmap notes, links, and detailed descriptions.
        </p>
        <p>
          This overview page stays as a simple entry point, while each project section can
          grow independently over time.
        </p>
      </div>
    </div>
  );
}

export default ProjectsPage;
