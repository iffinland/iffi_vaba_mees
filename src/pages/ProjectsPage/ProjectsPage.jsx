import { useState } from 'react';
import styles from './ProjectsPage.module.css';
import projectsImage from '../../assets/poster-my-projects.webp';

function ProjectsPage() {
  const [activeTab, setActiveTab] = useState('own'); // 'own' on vaikimisi aktiivne

  return (
    <div className={styles.container}>
      <img src={projectsImage} alt="iffi's various projects" className={styles.pageImage} />
      <h1 className={styles.title}>iffi's various projects</h1>
      <h4><strong>This is the projects page. An overview of the projects I am working on or in.</strong></h4>

      {/* Nuppude konteiner */}
      <div className={styles.tabContainer}>
        <button
          className={`${styles.tabButton} ${activeTab === 'own' ? styles.active : ''}`}
          onClick={() => setActiveTab('own')}
        >
          My Own Projects
        </button>
        <button
          className={`${styles.tabButton} ${activeTab === 'collaboration' ? styles.active : ''}`}
          onClick={() => setActiveTab('collaboration')}
        >
          Collaboration Projects
        </button>
      </div>

      {/* Sisu, mis muutub vastavalt aktiivsele vahelehele */}
      <div className={styles.tabContent}>
        {activeTab === 'own' && (
          <>
            <h2>These are my own started projects.</h2>
            <p>Projects I have created here on the QORTAL network. Not everything is perfect yet and is largely still at the idea level and needs more detailed development for the future, as is the fantastic and freeing QORTAL project.</p>
            <ul>
              <li>The biggest project is of course my real life project, which you can learn more about on the <a href="qortal://WEBSITE/iffi%20forest%20life"><strong>iffi forest life</strong></a> website</li>
              <li>I have also made it my goal to introduce Qortal more widely in Finland. You can learn more about this endeavor at <a href="qortal://WEBSITE/Qortal_Suomi_virallinen_tietosivu"><strong>Qortal Suomi Virallinen Tietosivu"</strong></a></li>
              <li>A project related to the above is currently under development, namely the creation of a community for Finnish users. You can follow its progress on this <a href="qortal://WEBSITE/suomen%20vapaiden%20ihmisten%20kommuuni"><strong>"SVIK - suomen vapaiden ihmisten kommuuni"</strong></a> website.</li>
              <li>I'm trying to get involved in a musical project as much as I can, so you can find out and decide for yourself what it is by visiting the <a href="qortal://WEBSITE/ASOT%20-%20A%20State%20Of%20Trance"><strong>"ASOT - A State Of Trance"</strong></a> website.</li>
            </ul>
            <hr />
            <p>
            Of course, there are still many ideas of what could still be done and created here at QORTAL, but unfortunately, not everything can be done right away due to lack of time and to a certain extent also purely physically. As I have written, I see strong future potential in Qortal and I have directed my main focus here to build a new and better future. WEB2 is a sinking ship for me!!!
            <br /><br />
            ...I also want to develop this page and write a little more about myself - share a general picture of what my life journey has been like. It seems quite exciting to me, what has happened to me in recent years. I can't even imagine it myself - of course the changes have only been in a positive direction. All in order - keep an eye on this website or my other QORTAL channels
            </p>
          </>
        )}

        {activeTab === 'collaboration' && (
          <>
            <h2>These are projects where I contribute as part of a team</h2>
            <p>...I will also try to give my best contribution to the following projects for the purpose of collaboration and help them develop in order to create a better user experience for all current and future users.</p>
            <ul>
              <li><a href="https://github.com/iffinland"><strong>Qortal app translation - GitHub</strong></a> - I have created a Finnish UI, HUB Estonian translation and from time to time I have to work on it to make updates/improvements.</li>
              <li><a href="qortal://WEBSITE/Qortal%20Web%20Builders"><strong>QWB - Qortal Web Builders</strong></a> - I offer my skills in building HTML websites as a hobby.</li>
              <li>As opportunities arise, I share my skills and knowledge with the <a href="qortal://WEBSITE/Eestlased%20Qortalis"><strong>"Eestlased Qortalis"</strong></a> project.</li>
            </ul>
            <hr />
            <p>
            Of course, there are still many ideas of what could still be done and created here at QORTAL, but unfortunately, not everything can be done right away due to lack of time and to a certain extent also purely physically. As I have written, I see strong future potential in Qortal and I have directed my main focus here to build a new and better future. WEB2 is a sinking ship for me!!!
            <br /><br />
            ...I also want to develop this page and write a little more about myself - share a general picture of what my life journey has been like. It seems quite exciting to me, what has happened to me in recent years. I can't even imagine it myself - of course the changes have only been in a positive direction. All in order - keep an eye on this website or my other QORTAL channels
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default ProjectsPage;
