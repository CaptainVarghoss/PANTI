import React, { useState, useEffect, Suspense, lazy } from 'react';

// Step 1: Pre-define static import promises for each react-icons module.
// These are promises that will resolve to the module exports (e.g., { MdEdit: Function, ... }).
const iconModulePromises = {
  Ai: import('react-icons/ai'),
  Bs: import('react-icons/bs'),
  Bi: import('react-icons/bi'),
  Ci: import('react-icons/ci'),
  Cg: import('react-icons/cg'),
  Di: import('react-icons/di'),
  Fi: import('react-icons/fi'),
  Fc: import('react-icons/fc'),
  Fa: import('react-icons/fa6'),
  Gi: import('react-icons/gi'),
  Go: import('react-icons/go'),
  Gr: import('react-icons/gr'),
  Hi: import('react-icons/hi'),
  Im: import('react-icons/im'),
  Io4: import('react-icons/io'),
  Io5: import('react-icons/io5'),
  Md: import('react-icons/md'),
  Ri: import('react-icons/ri'),
  Si: import('react-icons/si'),
  Ti: import('react-icons/ti'),
  Vsc: import('react-icons/vsc'),
  Wi: import('react-icons/wi'),
  Tb: import('react-icons/tb'),
  Pi: import('react-icons/pi'),
  Lu: import('react-icons/lu'),
};

const Icon = ({ iconName }) => {
  const [ComponentToRender, setComponentToRender] = useState(null);
  const [loadingError, setLoadingError] = useState(false);

  useEffect(() => {
    setLoadingError(false);
    setComponentToRender(null);

    if (!iconName) {
      return;
    }

    let prefix = '';
    const possiblePrefixes = Object.keys(iconModulePromises);
    for (const p of possiblePrefixes) {
      if (iconName.startsWith(p)) {
        prefix = p;
        break;
      }
    }

    if (!prefix) {
      console.warn(`[Icon Component] Could not determine library prefix for "${iconName}".`);
      setLoadingError(true);
      return;
    }

    const modulePromiseFromMap = iconModulePromises[prefix]; // Get the promise from the map

    if (!modulePromiseFromMap) {
      console.warn(`[Icon Component] No import promise found for prefix "${prefix}".`);
      setLoadingError(true);
      return;
    }

    const SpecificLazyIcon = lazy(async () => {
      try {
        const moduleExports = await Promise.resolve(modulePromiseFromMap); 

        const Component = moduleExports[iconName];

        if (!Component) {
          console.error(`[Icon Component] Icon "${iconName}" not found in module for prefix "${prefix}". Available exports: ${Object.keys(moduleExports).join(', ')}`);
          throw new Error(`Icon "${iconName}" not found.`);
        }
        return { default: Component };
      } catch (error) {
        console.error(`[Icon Component] Failed to load or find icon "${iconName}":`, error);
        throw error;
      }
    });

    setComponentToRender(() => SpecificLazyIcon);

  }, [iconName]);

  if (!iconName) {
    return null;
  }

  if (loadingError) {
    return (
      <div style={{ color: 'red' }}>
        <small>Error: Could not load icon "{iconName}".</small>
      </div>
    );
  }

  return (
    <Suspense fallback={<span>Loading {iconName}...</span>}>
      {ComponentToRender ? <ComponentToRender /> : null}
    </Suspense>
  );
};

export default Icon;