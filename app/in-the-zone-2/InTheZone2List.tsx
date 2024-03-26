'use client'
import {
    List,
    ListItem,
    ListIcon,
    Text,
    Stack,
    Heading,
    Wrap,
    Box,
    Divider,
    Link,
    TableContainer,
    Table,
    Thead,
    Th,
    Tr,
    Td,
    Tbody,
  } from '@chakra-ui/react'

  import { InTheZone2Calender } from './InTheZone2Calender';
  
  import { ImFire } from "react-icons/im";
  import { GiGrowth } from "react-icons/gi";
  import { IoRefreshCircle } from "react-icons/io5";
  import { ExternalLinkIcon } from '@chakra-ui/icons'

  interface eventProps {
    nextDate: string;
  }

  export default function InTheZoneList({ nextDate }: eventProps) {
    const nextEvent = InTheZone2Calender.filter(date => date.date === nextDate);
    console.log(nextEvent)
    return (
    <Stack spacing={6}>
        {nextEvent.map((event)=>(
                    <TableContainer  textAlign="center">
                <Table size='sm' color={'white'} borderColor={'white'} border={'1px'}>
                <Thead >
                    <Tr>
                    <Th textAlign="center" textColor={'white'}>Date</Th>
                    <Th textAlign="center" textColor={'white'}>Workout</Th>
                    <Th textAlign="center" textColor={'white'}>Duration</Th>
                    <Th textAlign="center" textColor={'white'}>Stress Points</Th>
                    <Th textAlign="center" textColor={'white'}>9:30 CET</Th>
                    <Th textAlign="center" textColor={'white'}>14:30 CET</Th>
                    </Tr>
                </Thead>
                <Tbody>
                    <Tr>
                    <Td textAlign="center">{event.date}</Td>
                    <Td textAlign="center"><Link  color={'orange'} href = {`https://whatsonzwift.com/workouts/${event.workout}`} target='_Blank' isExternal>{event.workout}<ExternalLinkIcon mx='2px' /></Link></Td>
                    <Td textAlign="center">{event.duration}</Td>
                    <Td textAlign="center">{event.stressPoints}</Td>
                    <Td textAlign="center"><Link  color={'orange'} href = {`https://www.zwift.com/eu/events/view/${event.eventID1}`} target='_Blank' isExternal>Event Link<ExternalLinkIcon mx='2px' /></Link></Td>
                    <Td textAlign="center"><Link  color={'orange'} href = {`https://www.zwift.com/eu/events/view/${event.eventID2}`} target='_Blank' isExternal>Event Link<ExternalLinkIcon mx='2px' /></Link></Td>
                    </Tr>    
                </Tbody>
                </Table>
            </TableContainer>
        ))}
        <Box lineHeight={1}>
        <Heading size={{ base: 'md', sm: 'lg', md: 'xl' }} color='white'>Benefits of Zone 2 Training</Heading>
        <Wrap>
            <Text color={'white'} fontSize={'xs'} >Soruce:</Text>     
            <Link color={'orange'} fontSize={'xs'} href={'https://www.trainingpeaks.com/blog/zone-2-training-for-endurance-athletes/'} target='_Blank' isExternal>TrainingPeaks<ExternalLinkIcon mx='2px' /></Link>
        </Wrap>
        </Box>
        <Text color='white'>Zone 2 training targets the sweet spot of aerobic exercise intensity where you stimulate type 1 muschle fibers and the mitochondrial growth and function. In turn this will</Text>

    <List spacing={3} color={'white'} >

        <List spacing={3} color={'white'} >
            <ListItem>
                <ListIcon as={ImFire} color='red' fontSize={'20px'}/>
                Increase your capacity to burn fat and thereby preserve glycogen for the peak efforts
            </ListItem>
            <ListItem>
                <ListIcon as={IoRefreshCircle} color='blue' fontSize={'20px'}/>
                Increase lactate clearing capacity
            </ListItem>
        </List>
    </List>
    <Text color='white'>Find all you need to know (probably a bit more than that actually) about zone 2 training in the excellent video below from
     <Link color={'orange'} href={'https://www.youtube.com/@PeterAttiaMD/videos'} target='_Blank' isExternal> Peter Attia's</Link> podcast, <Link color={'orange'} href={'https://peterattiamd.com/podcast/'} target='_Blank' isExternal>The Drive</Link>, featuring Pogačar's coach and internationally
      renowned <Link color={'orange'} href={'https://twitter.com/doctorinigo'} target='_Blank' isExternal>Iñigo San Millán</Link></Text>
    <Divider/>
    </Stack>
    )
  }