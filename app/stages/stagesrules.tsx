'use client'
import {
    List,
    ListItem,
    ListIcon,
  } from '@chakra-ui/react'
  
  import { MdBackHand, MdPowerOff } from 'react-icons/md'
  import { FaSuperpowers,FaHeartCircleBolt } from "react-icons/fa6";
  import { LuBike } from "react-icons/lu";
  import { LuTimer } from "react-icons/lu";

  export default function StagesRules() {
    return (
    <List spacing={3} color={'white'} >
        <ListItem>
          <ListIcon as={MdBackHand} color='orange' fontSize={'20px'}/>
          Category Enforced
        </ListItem>
        <ListItem>
          <ListIcon as={FaSuperpowers} color='green.500' fontSize={'20px'}/>
          Power Meter Enforced
        </ListItem>
        <ListItem>
          <ListIcon as={FaHeartCircleBolt} color='red.500' fontSize={'20px'}/>
          Heart Rate Monitor Enforced
        </ListItem>
        <ListItem>
          <ListIcon as={MdPowerOff} color='yellow' fontSize={'20px'}/>
          No PowerUps
        </ListItem>
        <ListItem>
          <ListIcon as={LuTimer} color='white' fontSize={'20px'}/>
          Minimum 3 Seconds Time Gap (iTT excluded)
        </ListItem>
    </List>
    )
  }