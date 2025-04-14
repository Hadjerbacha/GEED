import React, { useState, useEffect } from 'react';
import * as FaIcons from 'react-icons/fa';
import * as AiIcons from 'react-icons/ai';
import { Link, useNavigate } from 'react-router-dom';
import '../style/Navbar.css';
import { IconContext } from 'react-icons';
import { jwtDecode } from 'jwt-decode';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSignOutAlt, faUser } from '@fortawesome/free-solid-svg-icons';
import { Button } from 'react-bootstrap';

const Navbar = () => {
  const [sidebar, setSidebar] = useState(false);
  const [users, setUsers] = useState([]);
  const [userId, setUserId] = useState("");
  const [currentUser, setCurrentUser] = useState(null);
  const navigate = useNavigate();

  const customIconStyle = {
    fontSize: '24px',
    transition: 'color 0.3s',
    cursor: 'pointer',
  };

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
      setUserId(decoded.userId);
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
      const found = users.find(u => u._id === userId);
      if (found) setCurrentUser(found);
    }
  }, [userId, users]);

  // Menu selon rôle
  const sidebarItems = [
    {
      title: 'Accueil',
      path: '/',
      icon: <AiIcons.AiFillHome />,
    },
    {
      title: currentUser?.role === 'admin' ? 'Ajouter utilisateur' : 'Utilisateurs',
      path: currentUser?.role === 'admin' ? '/Register' : '/consulte',
      icon: currentUser?.role === 'admin' ? <FaIcons.FaUserPlus /> : <FaIcons.FaUsers />,
    },
    {
      title: 'Documents',
      path: '/Document',
      icon: <FaIcons.FaPlus />,
    },
    {
      title: 'Workflows',
      path: '/workflows',
      icon: <FaIcons.FaTasks />,
    },
    {
      title: 'Tableau de bord',
      path: '/dashboard',
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
        <div className="d-flex justify-content-between align-items-center w-100 px-3">
          <Link to="#" className="menu-bars">
            <FaIcons.FaBars onClick={showSidebar} />
          </Link>

          <img src="/11.png" alt="Logo" width="100" height="50" style={{ marginLeft: 'auto', marginRight: 'auto' }} />

          <div className="user-dropdown d-flex align-items-center gap-3">
            {currentUser && (
              <>
                <span className="fw-bold">{currentUser.name} {currentUser.prenom}</span>
                <FontAwesomeIcon icon={faUser} />
              </>
            )}
            <FontAwesomeIcon icon={faSignOutAlt} style={customIconStyle} onClick={handleLogout} title="Déconnexion" />
          </div>
        </div>
      </div>

      <nav className={sidebar ? 'nav-menu active' : 'nav-menu'}>
        <ul className="nav-menu-items" onClick={showSidebar}>
          <li className="navbar-toggle">
            <Link to="#" className="menu-bars">
              <AiIcons.AiOutlineClose />
            </Link>
          </li>

          

          {sidebarItems.map((item, index) => (
            <li key={index} className="nav-text">
              <Link to={item.path}>
                {item.icon}
                <span className="ms-2">{item.title}</span>
              </Link>
            </li>
          ))}

          <li className="nav-text mt-3">
            <Button variant="danger" onClick={handleLogout} className="w-100">Déconnexion</Button>
          </li>
        </ul>
      </nav>
    </IconContext.Provider>
  );
};

export default Navbar;
