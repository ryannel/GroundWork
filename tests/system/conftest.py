import os
import pytest
import httpx

@pytest.fixture(scope="session")
def docker_compose_file(pytestconfig):
    """Path to the root docker-compose file."""
    return os.path.join(str(pytestconfig.rootdir), "..", "docker-compose.yml")

@pytest.fixture(scope="session")
def docker_compose_project_name():
    """Prefix for the compose project."""
    return "testloop-tests"

@pytest.fixture(scope="session")
def cluster(docker_ip, docker_services):
    """
    Ensure the docker-compose stack is up.
    Since application services are under profiles, we might need to export COMPOSE_PROFILES=all
    before running pytest, or explicitly pass it here.
    """
    os.environ["COMPOSE_PROFILES"] = "all"
    
    # Wait for DB, Redis, etc to be healthy
    docker_services.wait_until_responsive(
        timeout=60.0, pause=2.0, check=lambda: True # Add specific healthchecks here if needed
    )
    return docker_services

@pytest.fixture
async def api_client():
    """Generic async HTTPX client for interacting with the services."""
    async with httpx.AsyncClient(timeout=10.0) as client:
        yield client
