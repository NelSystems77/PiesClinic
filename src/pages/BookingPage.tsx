import React from 'react';
import { useNavigate } from 'react-router-dom';
import SolicitudCitaPublica from '../components/SolicitudCitaPublica';

const BookingPage = () => {
  const navigate = useNavigate();
  return <SolicitudCitaPublica onClose={() => navigate('/')} />;
};

export default BookingPage;
