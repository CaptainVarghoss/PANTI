import tinycolor from 'tinycolor2';

export const getTagStyles = (baseColor) => {
        const color = tinycolor(baseColor); // tinycolor can parse named colors, hex, rgb, etc.

        // Default styles if color is invalid or cannot be parsed
        if (!color.isValid()) {
            console.warn(`Invalid color provided: ${baseColor}. Using default styles.`);
            return {
                backgroundColor: 'rgba(128, 128, 128, 0.4)',
                color: 'rgba(0, 0, 0, 0.9)',
                borderColor: 'rgba(128, 128, 128, 0.9)',
                borderWidth: '1px',
                borderStyle: 'solid',
            };
        }

        return {
            backgroundColor: color.setAlpha(1).toRgbString(),   // 20% opacity for background
            color: color.darken(30).setAlpha(1).toRgbString(),             // 80% opacity for text (more vibrant)
            borderColor: color.darken(60).setAlpha(1).toRgbString(),      // 50% opacity for border
            borderWidth: '1px',
            borderStyle: 'solid',
        };
    };