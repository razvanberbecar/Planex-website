import React from 'react'
import { Link } from 'react-router-dom'

export default function Presentation() {
  return (
    <div style={styles.page}>

      {/* TOP SECTION */}
      <div style={styles.top}>
        <div style={styles.titleRow}>
          <span style={styles.titleThin}>Welcome to </span>
          <span style={styles.titleBold}>PLANEX</span>
        </div>
        <div style={styles.tagline}>"Plan Smart. Do More."</div>
        <div style={styles.icon}>📋</div>
      </div>

      {/* BOTTOM SECTION */}
      <div style={styles.bottom}>

        {/* LEFT: description */}
        <div style={styles.description}>
          Planex is a simple and efficient task-planning app designed to help
          users organize their daily activities. It allows you to create tasks,
          delete them, modify them and mark them as completed, making it easier
          to stay productive and keep track of your progress.
        </div>

        {/* RIGHT: From this → To this */}
        <div style={styles.visual}>

          <div style={styles.visualCol}>
            <span style={styles.visualLabel}>From this</span>
            <div style={styles.emptyBox} />
          </div>

          <div style={styles.arrow}>→</div>

          <div style={styles.visualCol}>
            <span style={styles.visualLabel}>To this</span>
            <div style={styles.checkedBox}>
              <svg viewBox="0 0 80 80" style={styles.checkSvg}>
                <polyline
                  points="15,42 33,60 65,22"
                  stroke="#111"
                  strokeWidth="9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              </svg>
            </div>
          </div>

        </div>
      </div>

      {/* ENTER BUTTON */}
      <Link to="/tasks" style={styles.button}>Enter Planex</Link>

    </div>
  )
}

const BOX = {
  width: 130,
  height: 130,
  borderRadius: 18,
  border: '6px solid #111',
  backgroundColor: 'rgba(100,115,80,0.55)',
}

const styles = {
  page: {
    minHeight: '100vh',
    width: '100%',
    background: 'linear-gradient(180deg, #c8cc9a 0%, #7a8c60 35%, #3a4a38 65%, #1e2535 100%)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    fontFamily: '"Courier New", Courier, monospace',
    padding: '40px 60px 60px',
    boxSizing: 'border-box',
  },

  /* ── TOP ── */
  top: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    marginBottom: 60,
  },
  titleRow: {
    fontSize: '3.2rem',
    lineHeight: 1.1,
    color: '#111',
  },
  titleThin: {
    fontWeight: 400,
  },
  titleBold: {
    fontWeight: 900,
    letterSpacing: 2,
  },
  tagline: {
    fontSize: '1rem',
    color: '#222',
    marginTop: 6,
  },
  icon: {
    fontSize: '2.4rem',
    marginTop: 12,
  },

  /* ── BOTTOM ── */
  bottom: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 80,
    width: '100%',
    maxWidth: 900,
    flex: 1,
  },

  description: {
    flex: '0 0 260px',
    fontSize: '0.85rem',
    lineHeight: 1.7,
    color: '#111',
    textAlign: 'left',
  },

  /* ── VISUAL ── */
  visual: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 30,
    flex: 1,
    justifyContent: 'center',
  },
  visualCol: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 10,
  },
  visualLabel: {
    fontSize: '0.85rem',
    color: '#111',
  },
  emptyBox: {
    ...BOX,
  },
  checkedBox: {
    ...BOX,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkSvg: {
    width: 80,
    height: 80,
  },
  arrow: {
    fontSize: '2.5rem',
    color: '#111',
    fontWeight: 'bold',
    marginTop: 30,
  },

  /* ── BUTTON ── */
  button: {
    marginTop: 50,
    padding: '14px 60px',
    fontSize: '1.1rem',
    fontFamily: '"Courier New", Courier, monospace',
    fontWeight: 'bold',
    color: '#111',
    backgroundColor: '#3a4558',
    color: '#ddd',
    textDecoration: 'none',
    borderRadius: 50,
    letterSpacing: 1,
  },
}