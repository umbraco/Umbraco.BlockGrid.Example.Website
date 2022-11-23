<#
    .DESCRIPTION
        This will send a request to trigger a Deploy extraction or return a valid bearer header token
        value to put in for the BearerToken authentication header to make an http request to a Deploy endpoint.
    .PARAMETER Action
        Trigger - Trigger deploy to start extraction. Requires BaseUrl and Reason.        
        GetStatus - Retrieves the status of an extraction.
        TriggerWithStatus - Trigger the deploy to start extraction and wait until it succeeds or fails and returns the status response.
        GetToken - Creates the HMAC Authentication token based on the Api key that is used in each request.

    .PARAMETER ApiKey
        The Deploy ApiKey

    .PARAMETER BaseUrl
        The base URL including the scheme, host, port excluding the trailing slash

    .PARAMETER Reason
        The reason for extraction, this is used for logging/information

    .PARAMETER TaskId
        The task Id to get the status for when using GetStatus. If not specified will get the status from the last/current task.

    .PARAMETER PollingDelaySeconds
        The number of seconds to delay in between polling. Default is 3.

    .EXAMPLE
        .\TriggerDeploy.ps1 -ApiKey "7C327019-20BB-4B49-B514-386415648981" -Action Trigger -BaseUrl "http://localhost:45332" -Reason "test" -Verbose

        Triggers a deployment and ensures any verbose info is printed to the screen and returns the json result as a string

    .EXAMPLE
        .\TriggerDeploy.ps1 -ApiKey "7C327019-20BB-4B49-B514-386415648981" -Action Trigger -BaseUrl "http://localhost:45332" -Reason "test" 

        Triggers a deployment and returns the json result as a string

    .EXAMPLE
        .\TriggerDeploy.ps1 -ApiKey "7C327019-20BB-4B49-B514-386415648981" -Action GetToken

        Returns the authentication token for triggering an extraction

    .EXAMPLE
        .\TriggerDeploy.ps1 -ApiKey "7C327019-20BB-4B49-B514-386415648981" -Action GetStatus -BaseUrl "http://localhost:45332"

        Returns the status for the current/last triggered extraction task

    .EXAMPLE
        .\TriggerDeploy.ps1 -ApiKey "7C327019-20BB-4B49-B514-386415648981" -Action GetStatus -BaseUrl "http://localhost:45332" -TaskId "8C327019-20BB-4B49-B514-386415648981"

        Returns the status for the triggered extraction task with the specified id
#>

param(
    [Parameter(Mandatory)]
    [ValidateSet('Trigger', 'GetToken', 'GetStatus', 'TriggerWithStatus')]
    [string] $Action,

    [Parameter(Mandatory)]
    [string] $ApiKey,

    [string] $BaseUrl,
    [string] $Reason,
    [string] $TaskId,
    [int] $PollingDelaySeconds=3
)

function Get-UnixTimestamp
{
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [DateTime] $Timestamp
    )

    $utcnow = [TimeZoneInfo]::ConvertTimeToUtc($Timestamp)
    $utcbase = New-Object DateTime 1970, 1, 1, 0, 0, 0, ([DateTimeKind]::Utc)
    $result = $utcnow - $utcbase
    $seconds = $result.TotalSeconds
    return $seconds    
}

function Get-Signature
{
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string] $RequestUri,
        [Parameter(Mandatory)]
        [DateTime] $Timestamp,
        [Parameter(Mandatory)]
        [string] $Nonce,
        [Parameter(Mandatory)]
        [string] $Secret
    )

    $unixTimestamp = Get-UnixTimestamp -Timestamp $Timestamp
    $secretBytes = [Text.Encoding]::UTF8.GetBytes($Secret)
    $signatureString = "$RequestUri$unixTimestamp$Nonce"
    $signatureBytes = [Text.Encoding]::UTF8.GetBytes($signatureString)

    $hmacsha = New-Object System.Security.Cryptography.HMACSHA256
    $hmacsha.key = $secretBytes
    $computedHashBytes = $hmacsha.ComputeHash($signatureBytes)
    $computedString = [Convert]::ToBase64String($computedHashBytes)

    return $computedString
}

function Get-AuthorizationHeader
{
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string] $Signature,
        [Parameter(Mandatory)]
        [string] $Nonce,
        [Parameter(Mandatory)]
        [DateTime] $Timestamp
    )

    $unixTimestamp = Get-UnixTimestamp -Timestamp $Timestamp
    $token = "${Signature}:${Nonce}:${unixTimestamp}"
    $tokenBytes = [Text.Encoding]::UTF8.GetBytes($token)
    $encoded = [Convert]::ToBase64String($tokenBytes)
    return $encoded
}

function Send-Request
{
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string] $Token,
        [Parameter(Mandatory)]
        [string] $Endpoint,
        [Parameter(Mandatory)]
        [string] $BaseUrl,
        [Parameter(Mandatory)]
        [string] $Action
    )

    $uri = "${BaseUrl}${Endpoint}"

    Write-Verbose "Sending request to $uri"

    # Powershell is supposed to support the Authentication parameter for Invoke-WebRequest but it doesn't until later versions
    $headers = @{
        Authorization = "Bearer $Token"
    }

    $response = Invoke-WebRequest -Uri $uri -Headers $headers -ContentType "application/json" -Method $Action
    Write-Verbose $response

    if ($response.StatusCode -ne 200){        
        throw "Cannot continue the request failed. Use -Verbose flag for more info"
    }

    return $response
}

function Poll-ExtractionResult
{
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [int] $PollingDelaySeconds,
        [Parameter(Mandatory)]
        [string] $Token,
        [Parameter(Mandatory)]
        [string] $Endpoint,
        [Parameter(Mandatory)]
        [string] $BaseUrl,
        [Parameter(Mandatory)]
        $Json        
    )
        
    While ($Json.Status -eq "Executing" -or $Json.Status -eq "New") {
        Write-Verbose "Still in progress..."
        Start-Sleep -Seconds $PollingDelaySeconds
        $response = Send-Request -Token $Token -BaseUrl $BaseUrl -Endpoint $Endpoint -Action Get

        $Json = ConvertFrom-Json -InputObject $response.Content
    }

    return $Json
}

function Get-RequestParameters
{
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string] $Endpoint
    )

    $now = Get-Date
    $nonce = New-Guid
    $signature = Get-Signature -RequestUri $Endpoint -Timestamp $now -Nonce $nonce -Secret $ApiKey
    $token = Get-AuthorizationHeader -Signature $signature -Nonce $nonce -Timestamp $now

    return @{
        Signature = $signature
        Token = $token
        Endpoint = $Endpoint
    }
}

if ($Action -eq "GetToken" -or $Action -eq "Trigger" -or $Action -eq "TriggerWithStatus") {
    if ([string]::IsNullOrEmpty($Reason)) {
        throw "$Reason cannot be null or empty"
    }

    $requestParams = Get-RequestParameters -Endpoint "/umbraco/umbracodeploy/extract/start/$Reason"
}

if ($Action -eq "GetToken") {
    return $requestParams.Token
}
else {

    if ([string]::IsNullOrEmpty($BaseUrl)) {
        throw "BaseUrl cannot be null or empty"
    }

    if ($Action -eq "Trigger" -or $Action -eq "TriggerWithStatus") {
        
        $response = Send-Request -Token $requestParams.Token -BaseUrl $BaseUrl -Endpoint $requestParams.Endpoint -Action Post
        
        $json = ConvertFrom-Json -InputObject $response.Content
        $TaskId = $json.TaskId # The task Id result

        if ($Action -eq "Trigger") {
            return $response.ToString()
        }
    }

    if ($Action -eq "GetStatus" -or $Action -eq "TriggerWithStatus") {
        if ([string]::IsNullOrEmpty($TaskId)) {
            $requestParams = Get-RequestParameters -Endpoint "/umbraco/umbracodeploy/statusreport/getcurrent"            
        }
        else {
            $requestParams = Get-RequestParameters -Endpoint "/umbraco/umbracodeploy/statusreport/get/$TaskId"
        }
        
        $response = Send-Request -Token $requestParams.Token -BaseUrl $BaseUrl -Endpoint $requestParams.Endpoint -Action Get

        $json = ConvertFrom-Json -InputObject $response.Content

        if ($Action -eq "GetStatus") {
            return $json
        }
        else {

            $json = Poll-ExtractionResult -Token $requestParams.Token -Endpoint $requestParams.Endpoint -BaseUrl $BaseUrl -Json $json -PollingDelaySeconds $PollingDelaySeconds
          
            # if the response is unknown it most likely means that the app restarted after we first initialized
            # the extraction in which case the status gets removed from memory, so we'll retry the whole thing
            if ($json.Status -eq "Unknown") {
                Write-Verbose "Status result is Unknown, retrying Extraction again..."

                Start-Sleep -Seconds $PollingDelaySeconds

                # send the extraction again
                $requestParams = Get-RequestParameters -Endpoint "/umbraco/umbracodeploy/extract/start/$Reason"
                $response = Send-Request -Token $requestParams.Token -BaseUrl $BaseUrl -Endpoint $requestParams.Endpoint -Action Post
                $json = ConvertFrom-Json -InputObject $response.Content
                $TaskId = $json.TaskId # The task Id result

                # update the values to poll again
                $requestParams = Get-RequestParameters -Endpoint "/umbraco/umbracodeploy/statusreport/get/$TaskId"
                $response = Send-Request -Token $requestParams.Token -BaseUrl $BaseUrl -Endpoint $requestParams.Endpoint -Action Get
                $json = ConvertFrom-Json -InputObject $response.Content

                $json = Poll-ExtractionResult -Token $requestParams.Token -Endpoint $requestParams.Endpoint -BaseUrl $BaseUrl -Json $json -PollingDelaySeconds $PollingDelaySeconds
            }

            if ($json.Status -ne "Completed") {
                $err = $json.Status
                if (-not ([string]::IsNullOrEmpty($json.Log))) {
                    $err = $json.Log
                }
                elseif ($json.Exception) {
                    $err = $json.Exception
                }
                throw "UmbracoDeploy extraction failed. Response: $($err)"
            }

            return $json
        }
    }
}
