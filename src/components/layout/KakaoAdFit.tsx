import React, { useEffect, useRef } from 'react';

interface KakaoAdFitProps {
    type: 'desktop' | 'mobile';
}

export const KakaoAdFit: React.FC<KakaoAdFitProps> = ({ type }) => {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!containerRef.current) return;

        const id = type === 'desktop' ? "DAN-Z709wuZSIe2VIrdS" : "DAN-gAhn7q3JQOSPUeTo";
        const width = type === 'desktop' ? "728" : "320";
        const height = type === 'desktop' ? "90" : "50";

        // 기존 광고 지우기
        containerRef.current.innerHTML = '';

        // ins 엘리먼트 생성
        const ins = document.createElement('ins');
        ins.className = 'kakao_ad_area';
        ins.style.display = 'none';
        ins.setAttribute('data-ad-unit', id);
        ins.setAttribute('data-ad-width', width);
        ins.setAttribute('data-ad-height', height);

        // script 엘리먼트 생성
        const script = document.createElement('script');
        script.type = 'text/javascript';
        script.src = '//t1.daumcdn.net/kas/static/ba.min.js';
        script.async = true;

        containerRef.current.appendChild(ins);
        containerRef.current.appendChild(script);

        return () => {
            if (containerRef.current) {
                containerRef.current.innerHTML = '';
            }
        };
    }, [type]);

    const wrapperDesktop = "hidden md:flex justify-center items-center w-full my-8 z-10 relative pointer-events-auto min-h-[90px]";
    const wrapperMobile = "flex md:hidden justify-center items-center w-full z-10 relative pointer-events-auto bg-black border-t border-white/10 shrink-0 min-h-[50px]";
    
    return <div ref={containerRef} className={type === 'desktop' ? wrapperDesktop : wrapperMobile} />;
};
