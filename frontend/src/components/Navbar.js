import React, { useState, useEffect } from 'react';
import * as FaIcons from 'react-icons/fa';
import * as AiIcons from 'react-icons/ai';
import { Link, useNavigate } from 'react-router-dom';
import '../style/Navbar.css';
import { IconContext } from 'react-icons';
import { jwtDecode } from 'jwt-decode';
import Dropdown from 'react-bootstrap/Dropdown';

const Navbar = () => {
  const [sidebar, setSidebar] = useState(false);
  const [users, setUsers] = useState([]);
  const [userId, setUserId] = useState("");
  const [currentUser, setCurrentUser] = useState(null);
  const navigate = useNavigate();



  const showSidebar = () => setSidebar(!sidebar);

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate('/');
  };

  // Décoder JWT pour récupérer userId
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      const decoded = jwtDecode(token);
      console.log("Token décodé:", decoded);
      setUserId(decoded.id); // ici tu fixes le problème
    }
  }, []);
  
  

  // Récupérer la liste des utilisateurs
  useEffect(() => {
    fetch('http://localhost:5000/api/auth/users')
      .then(res => res.json())
      .then(data => setUsers(data))
      .catch(err => console.error('Erreur chargement utilisateurs :', err));
  }, []);

  // Associer userId au user courant
  useEffect(() => {
    if (userId && users.length > 0) {
      const found = users.find(u => u.id === userId);
      if (found) setCurrentUser(found);
    }
  }, [userId, users]);

  useEffect(() => {
    if (currentUser) {
      console.log("Utilisateur connecté :", currentUser);
    }
  }, [currentUser]);
  
  // Menu selon rôle
  const sidebarItems = [
    {
      title: 'Accueil',
      path: '/',
      icon: <AiIcons.AiFillHome />,
    },
    currentUser?.role === 'admin' && {
      title: 'Ajouter utilisateur',
      path: '/AdminUsers',
      icon: <FaIcons.FaUserPlus />,
    },
    
    {
      title: 'Documents',
      path: '/Document',
      icon: <FaIcons.FaPlus />,
    },
    /*{
      title: 'Workflows',
      path: '/workflows',
      icon: <FaIcons.FaTasks />,
    },*/
    {
      title: 'Tâches créées par moi',
      path: '/workflows',
      icon: <FaIcons.FaClipboardList />,
    },
    {
      title: 'Tâches assignées à moi',
      path: '/mes-taches',
      icon: <FaIcons.FaUserCheck />,
    },
    {
      title: 'Tableau de bord',
      path: '/mes-taches',
      icon: <FaIcons.FaChartBar />,
    },
    {
      title: 'Archive',
      path: currentUser?.role === 'admin' ? '/archive' : '/archiveUser',
      icon: <FaIcons.FaArchive />,
    },
  ];

  return (
    <IconContext.Provider value={{ color: '#000' }}>
      <div className="navbar">
      <div className="navbar-content">
          <Link to="#" className="menu-bars">
            <FaIcons.FaBars onClick={showSidebar} />
          </Link>

          <img src="/11.png" alt="Logo" width="100" height="50" style={{ marginLeft: 'auto', marginRight: 'auto' }} />
          {currentUser ? (
  <Dropdown>
    <Dropdown.Toggle variant="light" id="dropdown-basic" className="text-success fw-bold">
      {currentUser.name} {currentUser.prenom}
    </Dropdown.Toggle>

    <Dropdown.Menu>
      <Dropdown.Item href="/help">Aide</Dropdown.Item>
      <Dropdown.Divider />
      <Dropdown.Item onClick={handleLogout} className="text-danger">
        Déconnexion
      </Dropdown.Item>
    </Dropdown.Menu>
  </Dropdown>
) : (
  <div className="text-danger">Aucun utilisateur connecté</div>
)}


        </div>
      </div>

      <nav className={sidebar ? 'nav-menu active' : 'nav-menu'} style={{ zIndex: 200 }}>
        <ul className="nav-menu-items" onClick={showSidebar}>
          <li className="navbar-toggle">
            <Link to="#" className="menu-bars">
              <AiIcons.AiOutlineClose />
            </Link>
          </li>

          

          {sidebarItems
  .filter(Boolean)
  .map((item, index) => (
    <li key={index} className="nav-text">
      <Link to={item.path}>
        {item.icon}
        <span className="ms-2">{item.title}</span>
      </Link>
    </li>
))}
        </ul>
      </nav>
    </IconContext.Provider>
  );
};

export default Navbar;
