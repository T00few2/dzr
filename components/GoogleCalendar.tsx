import React from "react";
import {
  Flex,
  Container,
  chakra,
  VisuallyHidden,
  Heading,
  Stack,
  Text,
  Button,
  Icon,
  IconProps,
  Circle,
  Square,
} from '@chakra-ui/react'

interface GoogleCalendarEmbedProps {
  calendarId: string;
}

const GoogleCalendarEmbed: React.FC<GoogleCalendarEmbedProps> = ({ calendarId }) => {
  const url = `https://calendar.google.com/calendar/embed?src=${calendarId}&ctz=UTC&mode=WEEK`;
  return (
    <Stack
      textAlign={'center'}
      align={'center'}
      spacing={{ base: 4, md: 6 }}
      py={{ base: 4, md: 6 }}
      width="100%"
      >
      <Flex justify="center" align="center" bg="white" p={2} width="100%" maxW="100%">
        <iframe
          title="Google Calendar Embed"
          src={url}
          style={{ border: "solid 1px #777", width: "100%" }}
          height="600"
        ></iframe>
      </Flex>
    </Stack>
  );
};

export default GoogleCalendarEmbed;