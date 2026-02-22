'use client'

import {
  IconButton,
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
  FiLogOut,
  FiLogIn,
} from 'react-icons/fi'
import { HamburgerIcon } from '@chakra-ui/icons'
import { LiaMountainSolid } from "react-icons/lia";
import { Im500Px } from "react-icons/im";
import { MdDirectionsBike, MdInsights, MdInfo } from "react-icons/md";
import { IconType } from 'react-icons'
import { FaTrophy } from "react-icons/fa6";
import { AiOutlineAim } from "react-icons/ai";
import { RiBoxingFill } from "react-icons/ri";
import { MdOutlineTimer } from "react-icons/md";
import { GiDevilMask } from "react-icons/gi";
import Sparkles from 'react-sparkle'
import { useSession, signIn, signOut } from 'next-auth/react'
import { FaUser, FaUserCircle } from 'react-icons/fa'

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
  //{ name: 'STAGES by DZR', href: '/stages', icon: MdOutlineTimer },
  // { name: 'The SANTA league', href: '/santa', icon: LiaMountainSolid },
  { name: 'DZR After Party Series', href: '/dzr-after-party', icon: LiaMountainSolid },
  // { name: 'A Sunday in Hell', href: '/asundayinhell', icon: GiDevilMask },
  { name: 'In The Zone 2', href: '/in-the-zone-2', icon: AiOutlineAim },
  { name: 'The Zwifty Fifty', href: '/the-zwifty-fifty', icon: Im500Px },
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
        <Link href='/'><Image
          display={'flex'}
          boxSize='50px'
          src='/general/DZR_logo.svg'
          alt='DZR logo'
          rounded={'md'}
        />
        </Link>
        <CloseButton display={'flex'} onClick={onClose} color='white' size={'s'} />
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
      style={{ textDecoration: 'none' }}
      _focus={{ boxShadow: 'none' }}>
      <Flex
        align="center"
        p="4"
        mx="4"
        borderRadius="lg"
        role="group"
        cursor="pointer"
        color='white'
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

// Match left sidebar item styling for the profile drawer
const ProfileNavItem = ({ children, href, onClick, icon }: { children: React.ReactNode; href?: string; onClick?: () => void; icon?: IconType }) => {
  const commonProps = {
    style: { textDecoration: 'none' as const },
  }
  if (href) {
    return (
      <Box as="a" href={href} display={'block'} w={'100%'} {...commonProps}>
        <Flex
          align="center"
          p="4"
          mx="4"
          borderRadius="lg"
          role="group"
          cursor="pointer"
          color={'white'}
          fontWeight="900"
          w={'calc(100% - 2rem)'}
          _hover={{ bg: 'white', color: 'black' }}
        >
          {icon && (
            <Icon
              mr="4"
              fontSize="16"
              _groupHover={{ color: 'black' }}
              as={icon}
            />
          )}
          {children}
        </Flex>
      </Box>
    )
  }
  return (
    <Box as="button" onClick={onClick} display={'block'} w={'100%'} {...commonProps}>
      <Flex
        align="center"
        p="4"
        mx="4"
        borderRadius="lg"
        role="group"
        cursor="pointer"
        color={'white'}
        fontWeight="900"
        w={'calc(100% - 2rem)'}
        _hover={{ bg: 'white', color: 'black' }}
      >
        {icon && (
          <Icon
            mr="4"
            fontSize="16"
            _groupHover={{ color: 'black' }}
            as={icon}
          />
        )}
        {children}
      </Flex>
    </Box>
  )
}

const MobileNav = ({ onOpen, ...rest }: MobileProps) => {
  const { data: session } = useSession()
  const { isOpen: isProfileOpen, onOpen: openProfile, onClose: closeProfile } = useDisclosure()
  const roles: string[] = Array.isArray((session?.user as any)?.roles) ? (session?.user as any).roles : []
  const isAdmin: boolean = Boolean((session?.user as any)?.isAdmin)
  const isCaptain: boolean = roles.includes('1195878349617250405')
  return (
    <Flex
      ml={0}
      px={4}
      height="20"
      alignItems="center"
      position={'fixed'}
      top={0}
      left={0}
      right={0}
      bg={'transparent'}
      zIndex={10}

      borderBottomWidth="0px"
      borderBottomColor={('transparent')}

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
        zIndex={10}
        _hover={{ bg: 'gray.700', borderColor: 'gray.700' }}
        fontSize={{ base: "34px", md: "44px" }}
        fontWeight='900'
      />

      {/* <Image 
          display={'flex'}
          boxSize='50px' 
          src='/general/DZR_logo.svg' 
          alt='DZR logo' 
          />
  */}

      <HStack spacing={{ base: '2', md: '6' }}>
        <IconButton
          display={'flex'}
          aria-label="open profile menu"
          onClick={openProfile}
          variant="outline"
          bg={('black')}
          borderColor={'black'}
          color={'white'}
          icon={<Icon as={FaUserCircle} />}
          zIndex={10}
          _hover={{ bg: 'gray.700', borderColor: 'gray.700' }}
          fontSize={{ base: "34px", md: "44px" }}
          fontWeight='900'
        />
      </HStack>
      <Drawer
        isOpen={isProfileOpen}
        placement="right"
        onClose={closeProfile}
        returnFocusOnClose={true}
        onOverlayClick={closeProfile}
        closeOnOverlayClick={true}
        size={'xs'}
      >
        <DrawerOverlay bg="rgba(173, 26, 45, 0.95)" />
        <DrawerContent bg={'black'}>
          <Box h="full" color={'white'}>
            <Flex h="20" alignItems="center" mx="8" justifyContent="space-between">
              <Link href='/members-zone'><Image
                display={'flex'}
                boxSize='50px'
                src='/general/DZR_logo.svg'
                alt='DZR logo'
                rounded={'md'}
              />
              </Link>
              <CloseButton display={'flex'} onClick={closeProfile} color='white' size={'s'} />
            </Flex>
            {session ? (
              <>
                <ProfileNavItem href="/members-zone/about" icon={MdInfo}>About</ProfileNavItem>
                <ProfileNavItem href="/members-zone/racing" icon={FaTrophy}>Racing</ProfileNavItem>
                <ProfileNavItem href="/members-zone/stats-hub" icon={MdInsights}>Stats</ProfileNavItem>
                <ProfileNavItem href="/members-zone/my-pages" icon={FaUserCircle}>My Pages</ProfileNavItem>
                <ProfileNavItem onClick={() => signOut({ callbackUrl: '/' })} icon={FiLogOut}>Logout</ProfileNavItem>
              </>
            ) : (
              <>
                <ProfileNavItem href="/members-zone/about" icon={MdInfo}>About</ProfileNavItem>
                <ProfileNavItem onClick={() => signIn()} icon={FiLogIn}>Log in</ProfileNavItem>
              </>
            )}
          </Box>
        </DrawerContent>
      </Drawer>

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
        closeOnOverlayClick={true}
        size={'xs'}
      >
        <DrawerOverlay bg="rgba(173, 26, 45, 0.95)" />
        <DrawerContent>
          <DrawerCloseButton color={'red'} />
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