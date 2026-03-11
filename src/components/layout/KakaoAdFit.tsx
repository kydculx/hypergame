import React, { useEffect, useRef } from 'react';

interface KakaoAdFitProps {
    type: 'desktop' | 'mobile';
}

export const KakaoAdFit: React.FC<KakaoAdFitProps> = ({ type }) => {
    const adRef = useRef<HTMLModElement>(null);
    const id = type === 'desktop' ? "DAN-Z709wuZSIe2VIrdS" : "DAN-gAhn7q3JQOSPUeTo";
    const width = type === 'desktop' ? "728" : "320";
    const height = type === 'desktop' ? "90" : "50";

    useEffect(() => {
        let script: HTMLScriptElement | null = null;
        const initAd = () => {
            if (adRef.current && !adRef.current.hasChildNodes()) {
                script = document.createElement('script');
                script.type = 'text/javascript';
                script.src = '//t1.daumcdn.net/kas/static/ba.min.js';
                script.async = true;
                adRef.current.appendChild(script);
            }
        };

        initAd();

        return () => {
            if (adRef.current) {
                adRef.current.innerHTML = '';
            }
        };
    }, [type]);

    const wrapperDesktop = "hidden md:flex justify-center w-full my-8 z-10 relative pointer-events-auto";
    const wrapperMobile = "flex md:hidden justify-center w-full z-10 relative pointer-events-auto bg-black border-t border-white/10 shrink-0";
    
    return (
        <div className={type === 'desktop' ? wrapperDesktop : wrapperMobile}>
            <ins className="kakao_ad_area"
                style={{ display: 'none' }}
                data-ad-unit={id}
                data-ad-width={width}
                data-ad-height={height}
                ref={adRef}>
            </ins>
        </div>
    );
};
