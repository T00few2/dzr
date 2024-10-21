// components/ComingSoon.tsx
import React from 'react';

const ComingSoon: React.FC = () => {
  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Coming Soon!</h1>
      <p style={styles.subtitle}>This page is a work in progress. Stay tuned for updates.</p>
    </div>
  );
};

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    textAlign: 'center' as 'center',
    backgroundColor: 'black',
    color: 'white',
    padding: '20px',
  },
  title: {
    fontSize: '3rem',
    margin: '0 0 10px',
  },
  subtitle: {
    fontSize: '1.5rem',
    margin: '0',
  },
};

export default ComingSoon;
