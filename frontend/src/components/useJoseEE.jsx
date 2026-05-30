import { useState, useCallback, useEffect, useRef } from 'react';
import sadPepe from '../images/sadpepe.gif';
import music from '../images/ee.mp3'; // <- tu canción

export default function DevToolsEasterEgg() {
  const [visible, setVisible] = useState(false);
  const audioRef = useRef(null);

  const openEgg = useCallback(() => {
    setVisible(true);
  }, []);

  const closeEgg = useCallback(() => {
    setVisible(false);

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, []);

  useEffect(() => {
    const blockKeys = (e) => {
      const { key, ctrlKey, shiftKey } = e;

      const isDevTools =
        key === 'F12' ||
        (ctrlKey && shiftKey && ['I', 'i', 'J', 'j', 'C', 'c'].includes(key)) ||
        (ctrlKey && ['U', 'u'].includes(key));

      if (isDevTools) {
        e.preventDefault();
        e.stopPropagation();
        openEgg();
      }

      if (key === 'Escape') {
        closeEgg();
      }
    };

    const blockRightClick = (e) => {
      e.preventDefault();
      openEgg();
    };

    document.addEventListener('keydown', blockKeys, true);
    document.addEventListener('contextmenu', blockRightClick);

    return () => {
      document.removeEventListener('keydown', blockKeys, true);
      document.removeEventListener('contextmenu', blockRightClick);
    };
  }, [openEgg, closeEgg]);

  useEffect(() => {
    if (visible && audioRef.current) {
      audioRef.current.volume = 0.5;

      audioRef.current
        .play()
        .catch(() => console.log('Autoplay bloqueado por navegador'));
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <>
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: scale(1.08);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes floating {
          0%,100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-12px);
          }
        }
      `}</style>

      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          zIndex: 999999,
          background:
            'radial-gradient(circle at center, #1a1a1a 0%, #000 100%)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '2rem',
          overflow: 'hidden',
          animation: 'fadeIn .35s ease',
        }}
      >
        <audio ref={audioRef} loop>
          <source src={music} type="audio/mp3" />
        </audio>

        <img
          src={sadPepe}
          alt="Sad Pepe"
          style={{
            width: 'min(90vw, 420px)',
            borderRadius: '18px',
            boxShadow: '0 0 60px rgba(255,255,255,0.12)',
            animation: 'floating 3s ease-in-out infinite',
            userSelect: 'none',
            pointerEvents: 'none',
          }}
        />

        <div
          style={{
            textAlign: 'center',
            color: 'white',
            padding: '0 20px',
          }}
        >
          <h1
            style={{
              fontSize: 'clamp(2rem, 5vw, 4rem)',
              marginBottom: '1rem',
              fontWeight: 900,
            }}
          >
            YOU SHALL NOT PASS
          </h1>

          <p
            style={{
              fontSize: 'clamp(1rem, 2vw, 1.4rem)',
              opacity: 0.85,
              maxWidth: '700px',
              lineHeight: 1.6,
            }}
          >
            Jose paga a los desarrolladores,
            <br />
            no podemos más.
          </p>
        </div>

        <button
          onClick={closeEgg}
          style={{
            padding: '14px 28px',
            borderRadius: '12px',
            border: '1px solid rgba(255,255,255,0.2)',
            background: 'rgba(255,255,255,0.08)',
            color: 'white',
            fontSize: '1rem',
            cursor: 'pointer',
            transition: 'all .2s ease',
            backdropFilter: 'blur(10px)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.05)';
            e.currentTarget.style.background = 'rgba(255,255,255,0.15)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
          }}
        >
          Cerrar
        </button>
      </div>
    </>
  );
}