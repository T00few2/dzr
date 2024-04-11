
    import {Box, Tooltip, Heading, Text, Stack} from '@chakra-ui/react'
    import './css/Workout.css'

    export const WorkoutGraphSVG = () => (
    <div>
    <Stack spacing={6}>
    <Heading size={{ base: 'xs', sm: 'lg', md: 'xl' }} color = 'white'>Workout</Heading>
    <Text color = 'white'>Zone 2 training is one of the most important aspects of any training plan. We do not always get faster by training faster.

    In Zone 2 training we are stimulating your type I muscle fibers - slow twitch.

    Spending time in Zone 2 is absolutely essential to improving performance. This workout is a mashup of shorter zone 2 workouts - Zone 2 1, Cadence Pyramid & Aerobic Threshold Development - to get a long and varied zone 2 workout.</Text>
    <Box as='svg'
    viewBox='0 0 1000 100'
    width='100%'
    height={'auto'}
    transform= 'scaleY(-1)'>
    <svg><Tooltip label = " 2:30min @50%">
    <path d="M 0 0 L 0 50.0 L 18.54166605891205 50.0 L 18.54166605891205 0 0 Z" fill="grey" stroke="grey" />
    </Tooltip>
<Tooltip label = " 1:00min @60%">
    <path d="M 20.54166605891205 0 L 20.54166605891205 60.000001999999995 L 27.958332976921298 60.000001999999995 L 27.958332976921298 0 0 Z" fill="blue" stroke="blue" />
    </Tooltip>
<Tooltip label = " 1:00min @65%">
    <path d="M 29.958332976921298 0 L 29.958332976921298 64.999998 L 37.374999894930546 64.999998 L 37.374999894930546 0 0 Z" fill="blue" stroke="blue" />
    </Tooltip>
<Tooltip label = " 1:00min @81%">
    <path d="M 39.374999894930546 0 L 39.374999894930546 81.0 L 46.791666812939795 81.0 L 46.791666812939795 0 0 Z" fill="green" stroke="green" />
    </Tooltip>
<Tooltip label = " 1:00min @95%">
    <path d="M 48.791666812939795 0 L 48.791666812939795 94.999999 L 56.20833373094904 94.999999 L 56.20833373094904 0 0 Z" fill="yellow" stroke="yellow" />
    </Tooltip>
<Tooltip label = " 2:00min @50%">
    <path d="M 58.20833373094904 0 L 58.20833373094904 50.0 L 73.04166781418975 50.0 L 73.04166781418975 0 0 Z" fill="grey" stroke="grey" />
    </Tooltip>
<Tooltip label = " 4:00min @80%">
    <path d="M 75.04166781418975 0 L 75.04166781418975 80.000001 L 104.70833598067117 80.000001 L 104.70833598067117 0 0 Z" fill="green" stroke="green" />
    </Tooltip>
<Tooltip label = " 2:00min @50%">
    <path d="M 106.70833598067117 0 L 106.70833598067117 50.0 L 121.5416688278008 50.0 L 121.5416688278008 0 0 Z" fill="grey" stroke="grey" />
    </Tooltip>
<Tooltip label = " 6:00min ramp from 52% to 70%">
        <path d="M 123.5416688278008 0 L 123.5416688278008 51.930803000000004 L 142.37200481638655 60.0 L 142.37200481638655 0 0 Z" fill="grey" stroke="grey" />
        </Tooltip>
<Tooltip label = " 6:00min ramp from 52% to 70%">
        <path d="M 142.37200481638655 0 L 142.37200481638655 60.0 L 168.0416673691897 70.999993 L 168.0416673691897 0 0 Z" fill="blue" stroke="blue" />
        </Tooltip>
<Tooltip label = " 3:00min @70%">
    <path d="M 170.04166736918972 0 L 170.04166736918972 69.999999 L 192.29166911210632 69.999999 L 192.29166911210632 0 0 Z" fill="blue" stroke="blue" />
    </Tooltip>
<Tooltip label = " 7:00min ramp from 60% to 70%">
        <path d="M 194.29166911210632 0 L 194.29166911210632 60.000001999999995 L 246.20833778539327 70.999993 L 246.20833778539327 0 0 Z" fill="blue" stroke="blue" />
        </Tooltip>
<Tooltip label = " 7:00min ramp from 60% to 75%">
        <path d="M 248.20833778539327 0 L 248.20833778539327 60.000001999999995 L 300.125002750347 76.0 L 300.125002750347 0 0 Z" fill="blue" stroke="blue" />
        </Tooltip>
<Tooltip label = " 5:00min @75%">
    <path d="M 302.125002750347 0 L 302.125002750347 75.0 L 339.2083348681711 75.0 L 339.2083348681711 0 0 Z" fill="blue" stroke="blue" />
    </Tooltip>
<Tooltip label = " 6:30min ramp from 65% to 75%">
        <path d="M 341.2083348681711 0 L 341.2083348681711 65.14999900000001 L 388.75927601620367 76.0 L 388.75927601620367 0 0 Z" fill="blue" stroke="blue" />
        </Tooltip>
<Tooltip label = " 2:00min @62%">
    <path d="M 391.4166666213424 0 L 391.4166666213424 62.5 L 406.2500007045831 62.5 L 406.2500007045831 0 0 Z" fill="blue" stroke="blue" />
    </Tooltip>
<Tooltip label = " 2:00min @70%, Cadence 60">
    <path d="M 408.2500007045831 0 L 408.2500007045831 69.999999 L 423.0833347878238 69.999999 L 423.0833347878238 0 0 Z" fill="blue" stroke="blue" />
    </Tooltip>
<Tooltip label = " 1:00min @70%, Cadence 75">
    <path d="M 425.0833347878238 0 L 425.0833347878238 69.999999 L 432.50000170583303 69.999999 L 432.50000170583303 0 0 Z" fill="blue" stroke="blue" />
    </Tooltip>
<Tooltip label = " 1:00min @70%, Cadence 90">
    <path d="M 434.50000170583303 0 L 434.50000170583303 69.999999 L 441.91666862384227 69.999999 L 441.91666862384227 0 0 Z" fill="blue" stroke="blue" />
    </Tooltip>
<Tooltip label = " 1:00min @70%, Cadence 100">
    <path d="M 443.91666862384227 0 L 443.91666862384227 69.999999 L 451.3333355418515 69.999999 L 451.3333355418515 0 0 Z" fill="blue" stroke="blue" />
    </Tooltip>
<Tooltip label = " 1:00min @70%, Cadence 90">
    <path d="M 453.3333355418515 0 L 453.3333355418515 69.999999 L 460.75000245986075 69.999999 L 460.75000245986075 0 0 Z" fill="blue" stroke="blue" />
    </Tooltip>
<Tooltip label = " 1:00min @70%, Cadence 75">
    <path d="M 462.75000245986075 0 L 462.75000245986075 69.999999 L 470.16666937787 69.999999 L 470.16666937787 0 0 Z" fill="blue" stroke="blue" />
    </Tooltip>
<Tooltip label = " 2:00min @70%, Cadence 60">
    <path d="M 472.16666937787 0 L 472.16666937787 69.999999 L 487.0000034611107 69.999999 L 487.0000034611107 0 0 Z" fill="blue" stroke="blue" />
    </Tooltip>
<Tooltip label = " 2:00min @62%">
    <path d="M 489.0000034611107 0 L 489.0000034611107 62.5 L 503.8333363082403 62.5 L 503.8333363082403 0 0 Z" fill="blue" stroke="blue" />
    </Tooltip>
<Tooltip label = " 2:00min @70%">
    <path d="M 505.8333363082403 0 L 505.8333363082403 69.999999 L 520.666670391481 69.999999 L 520.666670391481 0 0 Z" fill="blue" stroke="blue" />
    </Tooltip>
<Tooltip label = " 1:00min @70%, Cadence 75">
    <path d="M 522.666670391481 0 L 522.666670391481 69.999999 L 530.0833373094903 69.999999 L 530.0833373094903 0 0 Z" fill="blue" stroke="blue" />
    </Tooltip>
<Tooltip label = " 1:00min @70%, Cadence 90">
    <path d="M 532.0833373094903 0 L 532.0833373094903 69.999999 L 539.5000042274995 69.999999 L 539.5000042274995 0 0 Z" fill="blue" stroke="blue" />
    </Tooltip>
<Tooltip label = " 1:00min @70%, Cadence 100">
    <path d="M 541.5000042274995 0 L 541.5000042274995 69.999999 L 548.9166711455088 69.999999 L 548.9166711455088 0 0 Z" fill="blue" stroke="blue" />
    </Tooltip>
<Tooltip label = " 1:00min @70%, Cadence 90">
    <path d="M 550.9166711455088 0 L 550.9166711455088 69.999999 L 558.333338063518 69.999999 L 558.333338063518 0 0 Z" fill="blue" stroke="blue" />
    </Tooltip>
<Tooltip label = " 1:00min @70%, Cadence 75">
    <path d="M 560.333338063518 0 L 560.333338063518 69.999999 L 567.7500049815272 69.999999 L 567.7500049815272 0 0 Z" fill="blue" stroke="blue" />
    </Tooltip>
<Tooltip label = " 2:00min @70%, Cadence 60">
    <path d="M 569.7500049815272 0 L 569.7500049815272 69.999999 L 584.583339064768 69.999999 L 584.583339064768 0 0 Z" fill="blue" stroke="blue" />
    </Tooltip>
<Tooltip label = " 2:00min @62%">
    <path d="M 586.583339064768 0 L 586.583339064768 62.5 L 601.4166719118977 62.5 L 601.4166719118977 0 0 Z" fill="blue" stroke="blue" />
    </Tooltip>
<Tooltip label = " 2:00min @70%, Cadence 60">
    <path d="M 603.4166719118977 0 L 603.4166719118977 69.999999 L 618.2500059951384 69.999999 L 618.2500059951384 0 0 Z" fill="blue" stroke="blue" />
    </Tooltip>
<Tooltip label = " 1:00min @70%, Cadence 75">
    <path d="M 620.2500059951384 0 L 620.2500059951384 69.999999 L 627.6666729131476 69.999999 L 627.6666729131476 0 0 Z" fill="blue" stroke="blue" />
    </Tooltip>
<Tooltip label = " 1:00min @70%, Cadence 90">
    <path d="M 629.6666729131476 0 L 629.6666729131476 69.999999 L 637.0833398311569 69.999999 L 637.0833398311569 0 0 Z" fill="blue" stroke="blue" />
    </Tooltip>
<Tooltip label = " 1:00min @70%, Cadence 100">
    <path d="M 639.0833398311569 0 L 639.0833398311569 69.999999 L 646.5000067491661 69.999999 L 646.5000067491661 0 0 Z" fill="blue" stroke="blue" />
    </Tooltip>
<Tooltip label = " 1:00min @70%, Cadence 90">
    <path d="M 648.5000067491661 0 L 648.5000067491661 69.999999 L 655.9166736671754 69.999999 L 655.9166736671754 0 0 Z" fill="blue" stroke="blue" />
    </Tooltip>
<Tooltip label = " 1:00min @70%, Cadence 75">
    <path d="M 657.9166736671754 0 L 657.9166736671754 69.999999 L 665.3333405851846 69.999999 L 665.3333405851846 0 0 Z" fill="blue" stroke="blue" />
    </Tooltip>
<Tooltip label = " 2:00min @70%, Cadence 60">
    <path d="M 667.3333405851846 0 L 667.3333405851846 69.999999 L 682.1666734323143 69.999999 L 682.1666734323143 0 0 Z" fill="blue" stroke="blue" />
    </Tooltip>
<Tooltip label = " 2:00min @62%">
    <path d="M 684.1666734323143 0 L 684.1666734323143 62.5 L 699.0000062794439 62.5 L 699.0000062794439 0 0 Z" fill="blue" stroke="blue" />
    </Tooltip>
<Tooltip label = " 2:00min @75%">
    <path d="M 701.0000062794439 0 L 701.0000062794439 75.0 L 715.8333391265736 75.0 L 715.8333391265736 0 0 Z" fill="blue" stroke="blue" />
    </Tooltip>
<Tooltip label = " 2:00min @70%">
    <path d="M 717.8333391265736 0 L 717.8333391265736 69.999999 L 732.6666719737033 69.999999 L 732.6666719737033 0 0 Z" fill="blue" stroke="blue" />
    </Tooltip>
<Tooltip label = " 2:00min @75%">
    <path d="M 734.6666719737033 0 L 734.6666719737033 75.0 L 749.5000048208329 75.0 L 749.5000048208329 0 0 Z" fill="blue" stroke="blue" />
    </Tooltip>
<Tooltip label = " 2:00min @70%">
    <path d="M 751.5000048208329 0 L 751.5000048208329 69.999999 L 766.3333376679626 69.999999 L 766.3333376679626 0 0 Z" fill="blue" stroke="blue" />
    </Tooltip>
<Tooltip label = " 2:00min @75%">
    <path d="M 768.3333376679626 0 L 768.3333376679626 75.0 L 783.1666705150923 75.0 L 783.1666705150923 0 0 Z" fill="blue" stroke="blue" />
    </Tooltip>
<Tooltip label = " 2:00min @70%">
    <path d="M 785.1666705150923 0 L 785.1666705150923 69.999999 L 800.000003362222 69.999999 L 800.000003362222 0 0 Z" fill="blue" stroke="blue" />
    </Tooltip>
<Tooltip label = " 2:00min @75%">
    <path d="M 802.000003362222 0 L 802.000003362222 75.0 L 816.8333362093516 75.0 L 816.8333362093516 0 0 Z" fill="blue" stroke="blue" />
    </Tooltip>
<Tooltip label = " 2:00min @70%">
    <path d="M 818.8333362093516 0 L 818.8333362093516 69.999999 L 833.6666690564813 69.999999 L 833.6666690564813 0 0 Z" fill="blue" stroke="blue" />
    </Tooltip>
<Tooltip label = " 2:00min @62%">
    <path d="M 835.6666690564813 0 L 835.6666690564813 62.5 L 850.500001903611 62.5 L 850.500001903611 0 0 Z" fill="blue" stroke="blue" />
    </Tooltip>
<Tooltip label = " 3:00min @75%">
    <path d="M 852.500001903611 0 L 852.500001903611 75.0 L 874.7500011743055 75.0 L 874.7500011743055 0 0 Z" fill="blue" stroke="blue" />
    </Tooltip>
<Tooltip label = " 2:00min @70%">
    <path d="M 876.7500011743055 0 L 876.7500011743055 69.999999 L 891.5833340214351 69.999999 L 891.5833340214351 0 0 Z" fill="blue" stroke="blue" />
    </Tooltip>
<Tooltip label = " 3:00min @75%">
    <path d="M 893.5833340214351 0 L 893.5833340214351 75.0 L 915.8333332921296 75.0 L 915.8333332921296 0 0 Z" fill="blue" stroke="blue" />
    </Tooltip>
<Tooltip label = " 2:00min @70%">
    <path d="M 917.8333332921296 0 L 917.8333332921296 69.999999 L 932.6666661392593 69.999999 L 932.6666661392593 0 0 Z" fill="blue" stroke="blue" />
    </Tooltip>
<Tooltip label = " 3:00min @75%">
    <path d="M 934.6666661392593 0 L 934.6666661392593 75.0 L 956.9166654099538 75.0 L 956.9166654099538 0 0 Z" fill="blue" stroke="blue" />
    </Tooltip>
<Tooltip label = " 2:00min @70%">
    <path d="M 958.9166654099538 0 L 958.9166654099538 69.999999 L 973.7499982570835 69.999999 L 973.7499982570835 0 0 Z" fill="blue" stroke="blue" />
    </Tooltip>
<Tooltip label = " 3:00min ramp from 65% to 50%">
        <path d="M 975.7499982570835 0 L 975.7499982570835 64.999998 L 984.0937471723956 59.0 L 984.0937471723956 0 0 Z" fill="blue" stroke="blue" />
        </Tooltip>
<Tooltip label = " 3:00min ramp from 65% to 50%">
        <path d="M 984.0937471723956 0 L 984.0937471723956 59.0 L 998.0000000000001 49.0 L 998.0000000000001 0 0 Z" fill="grey" stroke="grey" />
        </Tooltip></svg></Box></Stack></div>);