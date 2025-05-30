'use client'

import {
  IconButton,
  Avatar,
  Box,
  CloseButton,
  Flex,
  HStack,
  Link,
  VStack,
  Icon,
  useColorModeValue,
  Text,
  Drawer,
  DrawerContent,
  useDisclosure,
  BoxProps,
  FlexProps,
  Menu,
  MenuButton,
  MenuDivider,
  MenuItem,
  MenuList,
  Image,
  DrawerOverlay,
  DrawerProps,
  DrawerCloseButton,
} from '@chakra-ui/react'
import {
  FiHome,
  FiTrendingUp,
  FiCompass,
  FiStar,
  FiSettings,
  FiMenu,
  FiBell,
  FiChevronDown,
} from 'react-icons/fi'
import { HamburgerIcon } from '@chakra-ui/icons'
import { LiaMountainSolid } from "react-icons/lia";
import { Im500Px } from "react-icons/im";
import { MdDirectionsBike } from "react-icons/md";
import { IconType } from 'react-icons'
import { FaPeopleGroup } from "react-icons/fa6";
import { AiOutlineAim } from "react-icons/ai";
import { RiBoxingFill } from "react-icons/ri";
import { MdOutlineTimer } from "react-icons/md";
import Sparkles from 'react-sparkle'

interface LinkItemProps {
  name: string
  href: string
  icon: IconType
}

interface NavItemProps extends FlexProps {
  icon: IconType
  href: string
  children: React.ReactNode
}

interface MobileProps extends FlexProps {
  onOpen: () => void
}

interface SidebarProps extends BoxProps {
  onClose: () => void
}

const LinkItems: Array<LinkItemProps> = [
  { name: 'Home', href: '/', icon: MdDirectionsBike },
  // { name: 'Puncheurs Summer Cup', href: 'puncheurs-summer-cup', icon: RiBoxingFill },
  // { name: 'STAGES by DZR', href: '/stages', icon: MdOutlineTimer },
  { name: 'The SANTA league', href: '/santa', icon: LiaMountainSolid },
  { name: 'DZR After Party Series', href: '/dzr-after-party', icon: LiaMountainSolid },
  { name: 'In The Zone 2', href: '/in-the-zone-2', icon: AiOutlineAim },
  { name: 'The Zwifty Fifty', href: '/the-zwifty-fifty', icon: Im500Px },
  { name: 'Members Zone', href: '/members-zone', icon: FaPeopleGroup },
]

const SidebarContent = ({ onClose, ...rest }: SidebarProps) => {
  return (
    <Box
      transition="3s ease"
      bg={('black')}
      borderRight="0px"
      borderRightColor={('red')}
      w={{ base: 'full', md: 'xs' }}
      pos="fixed"
      h="full"
      {...rest}>
      <Flex h="20" alignItems="center" mx="8" justifyContent="space-between">
      <Link href= '/'>
        <Box position="relative">
          <Image 
            display={'flex'}
            boxSize='50px' 
            src='/general/DZR_admin_logo.svg' 
            alt='DZR Admin Dashboard' 
            rounded={'md'}
            transition="all 0.2s"
            _hover={{ transform: 'scale(1.05)' }}
          />
          {/* Optional admin badge overlay */}
          <Box 
            position="absolute" 
            top="-2px" 
            right="-2px" 
            bg="green.400" 
            color="white" 
            fontSize="8px" 
            fontWeight="bold" 
            px="1" 
            borderRadius="full"
            border="1px solid"
            borderColor="white"
          >
            ⚙️
          </Box>
        </Box>
        </Link>
        <CloseButton display={'flex'} onClick={onClose} color = 'white' size={'s'}/>
      </Flex>
      {LinkItems.map((link) => (
        <NavItem key={link.name} icon={link.icon} href={link.href}>
          {link.name}
        </NavItem>
      ))}
    </Box>
  )
}

const NavItem = ({ icon, children, href, ...rest }: NavItemProps) => {
  return (
    <Box
      as="a"
      href={href}
      style={{ textDecoration: 'none'}}
      _focus={{ boxShadow: 'none' }}>
      <Flex
        align="center"
        p="4"
        mx="4"
        borderRadius="lg"
        role="group"
        cursor="pointer"
        color = 'white'
        fontWeight="900"
        _hover={{
          bg: 'white',
          color: 'black',
        }}
        {...rest}>
        {icon && (
          <Icon
            mr="4"
            fontSize="16"
            _groupHover={{
              color: 'black',
            }}
            as={icon}
          />
        )}
        {children}
      </Flex>
    </Box>
  )
}

const MobileNav = ({ onOpen, ...rest }: MobileProps) => {
  return (
    <Flex
      ml={0}
      px={4}
      height="20"
      alignItems="center"
      
      borderBottomWidth="1px"
      borderBottomColor={('black')}
      
      justifyContent={'space-between'}
      
      >
        
      <IconButton
        display={'flex'}
        onClick={onOpen}
        variant="outline"
        aria-label="open menu"
        bg={('black')}
        borderColor={'black'}
        color={'white'}
        icon={<HamburgerIcon />}
        zIndex={20}
        position={'fixed'}
        _hover={{ bg: 'gray.700', borderColor: 'gray.700' }}
        fontSize={{base:"34px", md:"44px"}}
        fontWeight = '900'
      />
      
      {/* <Image 
          display={'flex'}
          boxSize='50px' 
          src='/general/DZR_logo.svg' 
          alt='DZR logo' 
          />
  */}
      
      
    </Flex>
  )
}

const SidebarWithHeader = () => {
  const { isOpen, onOpen, onClose } = useDisclosure()
  
  return (
    <Box>
      <SidebarContent onClose={() => onClose} display={'none'} />
      <Drawer
        isOpen={isOpen}
        placement="left"
        onClose={onClose}
        returnFocusOnClose={true}
        onOverlayClick={onClose}
        closeOnOverlayClick= {true}
        size={'xs'}
        >
        <DrawerOverlay  bg="rgba(173, 26, 45, 0.95)" />
        <DrawerContent>
          <DrawerCloseButton color={'red'}/>
          <SidebarContent onClose={onClose} />
        </DrawerContent>
      </Drawer>
      {/* mobilenav */}
      <MobileNav onOpen={onOpen} />
      <Box ml={0} p="0">
        {/* Content */}
      </Box>
    </Box>
  )
}

export default SidebarWithHeader