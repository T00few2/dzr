import React from 'react';
import { Box,Flex } from '@chakra-ui/react';

interface YouTubeEmbedProps {
  videoId: string;
}

const YouTubeEmbed: React.FC<YouTubeEmbedProps> = ({ videoId }) => {
  
  return (
    <Box
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      referrerPolicy="strict-origin-when-cross-origin"
      as="iframe"
      title="YouTube video player"
      width="95%"
      height="95%"
      style={{ aspectRatio: '560 / 315' }}
      src={`https://www.youtube.com/embed/${videoId}`}
      allowFullScreen
      key={videoId}
    />
  );
};

export default YouTubeEmbed;