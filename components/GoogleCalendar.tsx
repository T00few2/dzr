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
  //"https://calendar.google.com/calendar/embed?height=600&wkst=2&ctz=Europe%2FCopenhagen&bgcolor=%23ffffff&mode=WEEK&showTabs=0&showPrint=0&showCalendars=0&title&showTitle=0&hl=da&src=MTM4ZjEyMTliZmJlMDhjMzQ5M2EwNDU3MjMyZmMzMGRlNmI2ODExYzdiZGNiZjQzYzRlYTE0Yjg0NjI3MTM1ZEBncm91cC5jYWxlbmRhci5nb29nbGUuY29t&color=%23F4511E" 
  return (
    <Container maxW={'5xl'} bg={('black')} alignContent={'center'}>
    <Stack
      textAlign={'center'}
      align={'center'}
      spacing={{ base: 8, md: 10 }}
      py={{ base: 10, md: 10 }}
      alignContent={'center'}
      >
      <Heading
        fontSize={{ base: '3xl', sm: '4xl', md: '6xl' }}
        lineHeight={'110%'}
        textColor='white'>
        <Text>DZR Race Calendar</Text>
      </Heading>
  
  <Flex justify="center" align="center" bg="white"  p={2} width= "90vw"  >
  <iframe
        title="Google Calendar Embed"
        src={url}
        style={{ border: "solid 1px #777", width: "100%" }}
        height="600"
      ></iframe>
  
  </Flex>
  </Stack>
  </Container>

  );
};

export default GoogleCalendarEmbed;